package com.koluva.ledger;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Puente nativo de Koluva Ledger: datos locales, exportar/importar, actualización por APK firmado y recordatorios. */
@CapacitorPlugin(name = "LedgerNative")
public class LedgerNative extends Plugin {
    static final String CHANNEL = "ledger-reminders";
    static final long MAX_DATA = 80L * 1024 * 1024;
    static final Set<String> HOSTS = new HashSet<>(Arrays.asList("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"));

    private File dataFile() { return new File(getContext().getFilesDir(), "ledger-data.json"); }

    private static String readFile(File f) throws Exception {
        if (!f.isFile() || f.length() > MAX_DATA) return null;
        try (InputStream in = new FileInputStream(f)) { return new String(readAll(in, MAX_DATA), StandardCharsets.UTF_8); }
    }
    private static byte[] readAll(InputStream in, long max) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] b = new byte[16384]; int n; long t = 0;
        while ((n = in.read(b)) > 0) { t += n; if (t > max) throw new Exception("too-big"); out.write(b, 0, n); }
        return out.toByteArray();
    }

    @PluginMethod public void load(PluginCall call) {
        try { JSObject r = new JSObject(); String t = readFile(dataFile()); if (t != null) r.put("text", t); call.resolve(r); } catch (Exception e) { call.reject("load"); }
    }
    @PluginMethod public void loadBak(PluginCall call) {
        try { JSObject r = new JSObject(); String t = readFile(new File(dataFile().getPath() + ".bak")); if (t != null) r.put("text", t); call.resolve(r); } catch (Exception e) { call.reject("load"); }
    }
    @PluginMethod public void save(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.length() > MAX_DATA) { call.reject("save"); return; }
        try {
            File f = dataFile(), tmp = new File(f.getPath() + ".tmp"), bak = new File(f.getPath() + ".bak");
            try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(text.getBytes(StandardCharsets.UTF_8)); o.getFD().sync(); }
            if (f.exists()) { try (InputStream in = new FileInputStream(f); OutputStream o = new FileOutputStream(bak)) { byte[] b = new byte[16384]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); } }
            if (!tmp.renameTo(f)) throw new Exception("rename");
            call.resolve();
        } catch (Exception e) { call.reject("save"); }
    }

    @PluginMethod public void exportFile(PluginCall call) {
        String name = call.getString("name"), text = call.getString("text"), mime = call.getString("mime", "application/octet-stream");
        if (name == null || text == null || text.length() > MAX_DATA) { call.reject("save"); return; }
        try {
            File dir = new File(getContext().getCacheDir(), "exports"); dir.mkdirs();
            for (File old : dir.listFiles()) old.delete();
            File f = new File(dir, name.replaceAll("[^A-Za-z0-9._-]", "_"));
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(text.getBytes(StandardCharsets.UTF_8)); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent send = new Intent(Intent.ACTION_SEND); send.setType(mime); send.putExtra(Intent.EXTRA_STREAM, uri); send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, name); chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser); call.resolve();
        } catch (Exception e) { call.reject("save"); }
    }

    @PluginMethod public void importFile(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
        startActivityForResult(call, i, "importResult");
    }
    @ActivityCallback private void importResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data == null || data.getData() == null) { call.resolve(new JSObject()); return; }
        try {
            Uri u = data.getData(); String name = "file";
            try (Cursor c = getContext().getContentResolver().query(u, null, null, null, null)) { if (c != null && c.moveToFirst()) { int ix = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (ix >= 0) name = c.getString(ix); } }
            try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
                JSObject r = new JSObject(); r.put("name", name); r.put("text", new String(readAll(in, 60L * 1024 * 1024), StandardCharsets.UTF_8)); call.resolve(r);
            }
        } catch (Exception e) { call.reject("file"); }
    }

    @PluginMethod public void openUrl(PluginCall call) {
        try {
            Uri u = Uri.parse(call.getString("url", "")); String repo = "/koluvacorp/";
            boolean ok = "https".equals(u.getScheme()) && ("koluva.com".equals(u.getHost()) || "www.koluva.com".equals(u.getHost()) || ("github.com".equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith(repo)));
            if (!ok) { call.reject("url"); return; }
            Intent i = new Intent(Intent.ACTION_VIEW, u); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); call.resolve();
        } catch (Exception e) { call.reject("url"); }
    }

    /* ---------- actualización ---------- */
    private static HttpURLConnection open(String url) throws Exception {
        String cur = url;
        for (int hop = 0; hop < 6; hop++) {
            URL u = new URL(cur);
            if (!"https".equals(u.getProtocol()) || u.getUserInfo() != null || u.getPort() != -1 || !HOSTS.contains(u.getHost())) throw new Exception("host");
            HttpURLConnection c = (HttpURLConnection) u.openConnection(); c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setRequestProperty("User-Agent", "KoluvaLedger-Updater");
            int code = c.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) { String loc = c.getHeaderField("Location"); c.disconnect(); if (loc == null) throw new Exception("redirect"); cur = new URL(u, loc).toString(); continue; }
            if (code != 200) { c.disconnect(); throw new Exception("HTTP " + code); }
            return c;
        }
        throw new Exception("redirects");
    }
    @PluginMethod public void fetchText(PluginCall call) {
        final String url = call.getString("url", "");
        new Thread(() -> {
            try { HttpURLConnection c = open(url); try (InputStream in = c.getInputStream()) { JSObject r = new JSObject(); r.put("text", new String(readAll(in, 65536), StandardCharsets.UTF_8)); call.resolve(r); } finally { c.disconnect(); } }
            catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
        }).start();
    }
    @PluginMethod public void downloadApk(PluginCall call) {
        final String url = call.getString("url", ""), sha = call.getString("sha256", ""); final long size = call.getLong("size", 0L);
        if (size <= 0 || size > 400L * 1024 * 1024 || !sha.matches("[a-f0-9]{64}")) { call.reject("data"); return; }
        new Thread(() -> {
            File dir = new File(getContext().getCacheDir(), "updates"); dir.mkdirs();
            for (File o : dir.listFiles()) o.delete();
            File part = new File(dir, "ledger-update.apk.part"), apk = new File(dir, "ledger-update.apk");
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256"); long got = 0; int last = -1;
                HttpURLConnection c = open(url);
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
                    byte[] b = new byte[32768]; int n;
                    while ((n = in.read(b)) > 0) {
                        got += n; if (got > size) throw new Exception("size");
                        md.update(b, 0, n); out.write(b, 0, n);
                        int pct = (int) (got * 100 / size); if (pct != last) { last = pct; JSObject p = new JSObject(); p.put("pct", pct); notifyListeners("progress", p); }
                    }
                } finally { c.disconnect(); }
                StringBuilder hex = new StringBuilder(); for (byte x : md.digest()) hex.append(String.format("%02x", x));
                if (got != size || !hex.toString().equals(sha)) throw new Exception("verify");
                if (!part.renameTo(apk)) throw new Exception("rename");
                call.resolve();
            } catch (Exception e) { part.delete(); call.reject(String.valueOf(e.getMessage())); }
        }).start();
    }
    @PluginMethod public void installApk(PluginCall call) {
        try {
            File apk = new File(new File(getContext().getCacheDir(), "updates"), "ledger-update.apk");
            if (!apk.isFile()) { call.reject("no-apk"); return; }
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())); s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(s);
                call.reject("install-permission"); return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent i = new Intent(Intent.ACTION_VIEW); i.setDataAndType(uri, "application/vnd.android.package-archive"); i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i); call.resolve();
        } catch (Exception e) { call.reject("install"); }
    }

    /* ---------- recordatorios ---------- */
    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) { NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE); nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Koluva Ledger", NotificationManager.IMPORTANCE_DEFAULT)); }
    }
    private void askPermission() {
        if (Build.VERSION.SDK_INT >= 33 && getActivity() != null && ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
    }
    @PluginMethod public void notifyNow(PluginCall call) {
        askPermission(); ReminderReceiver.show(getContext(), (int) (System.currentTimeMillis() % 100000), call.getString("title", "Koluva Ledger"), call.getString("body", "")); call.resolve();
    }
    @PluginMethod public void setWidget(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences("ledger", Context.MODE_PRIVATE).edit().putString("w_title", call.getString("title", "Ledger")).putString("w_big", call.getString("big", "")).putString("w_sub", call.getString("sub", "")).putString("w_none", call.getString("none", "")).putString("w_rows", call.getString("rows", "[]")).apply();
        LedgerWidget.refresh(ctx); call.resolve();
    }
    @PluginMethod public void schedule(PluginCall call) {
        try {
            Context ctx = getContext(); AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            SharedPreferences sp = ctx.getSharedPreferences("ledger", Context.MODE_PRIVATE);
            for (String id : sp.getStringSet("alarms", new HashSet<>())) am.cancel(pending(ctx, Integer.parseInt(id), "", ""));
            JSONArray arr = new JSONArray(call.getString("items", "[]")); Set<String> ids = new HashSet<>();
            if (arr.length() > 0) askPermission();
            for (int k = 0; k < arr.length() && k < 60; k++) {
                JSONObject o = arr.getJSONObject(k); int id = o.getInt("id"); long at = o.getLong("at");
                if (at < System.currentTimeMillis()) continue;
                am.set(AlarmManager.RTC_WAKEUP, at, pending(ctx, id, o.optString("title"), o.optString("body"))); ids.add(String.valueOf(id));
            }
            sp.edit().putStringSet("alarms", ids).apply(); call.resolve();
        } catch (Exception e) { call.reject("schedule"); }
    }
    static PendingIntent pending(Context ctx, int id, String title, String body) {
        Intent i = new Intent(ctx, ReminderReceiver.class); i.putExtra("id", id); i.putExtra("title", title); i.putExtra("body", body);
        return PendingIntent.getBroadcast(ctx, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
