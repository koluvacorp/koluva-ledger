package com.koluva.ledger;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/* Widget "Podés gastar hoy" con los próximos pagos. Los datos los envía la app (LedgerNative.setWidget). */
public class LedgerWidget extends AppWidgetProvider {
    static final int[] ROWS = {R.id.lw_row1, R.id.lw_row2, R.id.lw_row3};
    static final int[] WHEN = {R.id.lw_when1, R.id.lw_when2, R.id.lw_when3};
    static final int[] TEXT = {R.id.lw_text1, R.id.lw_text2, R.id.lw_text3};
    static final int[] AMT = {R.id.lw_amt1, R.id.lw_amt2, R.id.lw_amt3};

    @Override public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(ctx));
    }

    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        for (int id : mgr.getAppWidgetIds(new ComponentName(ctx, LedgerWidget.class))) mgr.updateAppWidget(id, build(ctx));
    }

    static RemoteViews build(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences("ledger", Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_ledger);
        v.setTextViewText(R.id.lw_title, sp.getString("w_title", "Ledger"));
        v.setTextViewText(R.id.lw_big, sp.getString("w_big", "—"));
        v.setTextViewText(R.id.lw_sub, sp.getString("w_sub", ""));
        int shown = 0;
        try {
            JSONArray arr = new JSONArray(sp.getString("w_rows", "[]"));
            for (int k = 0; k < arr.length() && shown < ROWS.length; k++) {
                JSONObject o = arr.getJSONObject(k);
                v.setViewVisibility(ROWS[shown], View.VISIBLE);
                v.setTextViewText(WHEN[shown], o.optString("when")); v.setTextViewText(TEXT[shown], o.optString("text")); v.setTextViewText(AMT[shown], o.optString("amt"));
                shown++;
            }
        } catch (Exception ignored) { /* sin datos */ }
        for (int k = shown; k < ROWS.length; k++) v.setViewVisibility(ROWS[k], View.GONE);
        v.setTextViewText(R.id.lw_none, sp.getString("w_none", ""));
        v.setViewVisibility(R.id.lw_none, shown == 0 ? View.VISIBLE : View.GONE);
        Intent open = new Intent(ctx, MainActivity.class); open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.lw_root, PendingIntent.getActivity(ctx, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }
}
