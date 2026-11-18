package com.koluva.ledger;

import android.Manifest;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context ctx, Intent intent) {
        show(ctx, intent.getIntExtra("id", 1), intent.getStringExtra("title"), intent.getStringExtra("body"));
    }
    static void show(Context ctx, int id, String title, String body) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        LedgerNative.ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class); open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, LedgerNative.CHANNEL).setSmallIcon(R.drawable.ic_stat_ledger).setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(pi).setAutoCancel(true).setColor(0xFFC8102E);
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id, b.build());
    }
}
