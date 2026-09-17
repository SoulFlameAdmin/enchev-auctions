package com.soulflame.davidmonitor;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Locale;

public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private LinearLayout container;
    private TextView stateText;
    private TextView globalValue;
    private ProgressBar globalBar;
    private TextView wave0Value;
    private ProgressBar wave0Bar;
    private TextView currentTask;
    private TextView latestGreen;
    private TextView production;
    private TextView latestCommit;
    private TextView evidence;
    private TextView updated;
    private Button refreshButton;

    private final Runnable autoRefresh = new Runnable() {
        @Override public void run() {
            refresh();
            handler.postDelayed(this, 60_000L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        requestNotificationPermission();
        MonitorJobService.schedule(this);
        buildUi();
    }

    @Override
    protected void onStart() {
        super.onStart();
        handler.removeCallbacks(autoRefresh);
        handler.post(autoRefresh);
    }

    @Override
    protected void onStop() {
        handler.removeCallbacks(autoRefresh);
        super.onStop();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Color.rgb(7, 9, 13));

        container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setPadding(dp(18), dp(22), dp(18), dp(36));
        scroll.addView(container);

        TextView brand = text("DAVID MONITOR", 13, Color.rgb(124, 255, 178), true);
        brand.setLetterSpacing(0.18f);
        container.addView(brand);

        TextView title = text("ENCHEV AUCTIONS", 28, Color.WHITE, true);
        title.setPadding(0, dp(8), 0, 0);
        container.addView(title);

        TextView subtitle = text("Evidence-first international readiness", 14, Color.rgb(155, 164, 178), false);
        subtitle.setPadding(0, dp(4), 0, dp(18));
        container.addView(subtitle);

        stateText = text("● Зареждам реалното състояние…", 14, Color.rgb(255, 210, 92), true);
        container.addView(card(stateText));

        globalValue = text("—", 24, Color.WHITE, true);
        globalBar = progress();
        container.addView(metricCard("ЦЕЛИЯТ FROZEN PLAN", globalValue, globalBar));

        wave0Value = text("—", 24, Color.WHITE, true);
        wave0Bar = progress();
        container.addView(metricCard("WAVE 0 · DEFINITION & GOVERNANCE", wave0Value, wave0Bar));

        currentTask = text("—", 17, Color.WHITE, true);
        container.addView(infoCard("DAVID РАБОТИ / СЛЕДВА", currentTask));

        latestGreen = text("—", 16, Color.rgb(124, 255, 178), true);
        container.addView(infoCard("ПОСЛЕДНО ДОКАЗАНО GREEN", latestGreen));

        production = text("—", 16, Color.WHITE, true);
        container.addView(infoCard("PRODUCTION", production));

        latestCommit = text("—", 14, Color.rgb(218, 223, 232), false);
        container.addView(infoCard("ПОСЛЕДЕН COMMIT", latestCommit));

        evidence = text("—", 13, Color.rgb(180, 189, 202), false);
        evidence.setLineSpacing(0f, 1.18f);
        container.addView(infoCard("EVIDENCE", evidence));

        refreshButton = new Button(this);
        refreshButton.setText("ОПРЕСНИ СЕГА");
        refreshButton.setTextColor(Color.WHITE);
        refreshButton.setTextSize(14);
        refreshButton.setAllCaps(false);
        GradientDrawable buttonBg = new GradientDrawable();
        buttonBg.setColor(Color.rgb(34, 77, 55));
        buttonBg.setCornerRadius(dp(14));
        refreshButton.setBackground(buttonBg);
        refreshButton.setPadding(dp(12), dp(12), dp(12), dp(12));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        buttonParams.setMargins(0, dp(10), 0, 0);
        refreshButton.setLayoutParams(buttonParams);
        refreshButton.setOnClickListener(v -> refresh());
        container.addView(refreshButton);

        updated = text("Автоматично опресняване: 60 сек. · Часов отчет: Android notification", 12, Color.rgb(116, 126, 140), false);
        updated.setPadding(0, dp(16), 0, 0);
        container.addView(updated);

        setContentView(scroll);
    }

    private void refresh() {
        refreshButton.setEnabled(false);
        stateText.setText("● Проверявам GitHub + production…");
        stateText.setTextColor(Color.rgb(255, 210, 92));

        new Thread(() -> {
            try {
                MonitorClient.Result result = MonitorClient.fetch();
                runOnUiThread(() -> render(result));
            } catch (Exception error) {
                runOnUiThread(() -> {
                    stateText.setText("● Грешка при live проверката: " + error.getMessage());
                    stateText.setTextColor(Color.rgb(255, 112, 112));
                    refreshButton.setEnabled(true);
                });
            }
        }).start();
    }

    private void render(MonitorClient.Result result) {
        stateText.setText("● LIVE · evidence source е GitHub main");
        stateText.setTextColor(Color.rgb(124, 255, 178));

        globalValue.setText(String.format(Locale.US, "%.2f%% · %d/%d доказани GREEN", result.globalPercent, result.verifiedGreen, result.totalTasks));
        globalBar.setProgress((int) Math.round(result.globalPercent * 10));

        wave0Value.setText(String.format(Locale.US, "%.0f%% · %d/%d", result.wave0Percent, result.wave0Green, result.wave0Total));
        wave0Bar.setProgress((int) Math.round(result.wave0Percent * 10));

        currentTask.setText(result.currentTaskId + " · " + result.currentTaskLabel);
        latestGreen.setText(result.highestVerified);

        if (result.productionCode >= 200 && result.productionCode < 400) {
            production.setText("🟢 ONLINE · HTTP " + result.productionCode + " · enchev-auctions.vercel.app");
            production.setTextColor(Color.rgb(124, 255, 178));
        } else {
            production.setText("🔴 CHECK FAILED · HTTP " + result.productionCode);
            production.setTextColor(Color.rgb(255, 112, 112));
        }

        latestCommit.setText(result.commitSha + " · " + result.commitMessage + "\n" + result.commitDate);
        evidence.setText(result.highestEvidence);
        updated.setText("Последна live проверка: " + java.time.ZonedDateTime.now().toString() + "\nАвтоматично опресняване: 60 сек. · Часов отчет: Android notification");
        refreshButton.setEnabled(true);
    }

    private View metricCard(String label, TextView value, ProgressBar bar) {
        LinearLayout box = box();
        box.addView(text(label, 11, Color.rgb(139, 149, 164), true));
        value.setPadding(0, dp(8), 0, dp(8));
        box.addView(value);
        box.addView(bar);
        return box;
    }

    private View infoCard(String label, TextView value) {
        LinearLayout box = box();
        box.addView(text(label, 11, Color.rgb(139, 149, 164), true));
        value.setPadding(0, dp(8), 0, 0);
        box.addView(value);
        return box;
    }

    private View card(View content) {
        LinearLayout box = box();
        box.addView(content);
        return box;
    }

    private LinearLayout box() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(15), dp(16), dp(15));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.rgb(16, 20, 27));
        bg.setStroke(dp(1), Color.rgb(38, 45, 56));
        bg.setCornerRadius(dp(16));
        box.setBackground(bg);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, dp(12));
        box.setLayoutParams(params);
        return box;
    }

    private TextView text(String value, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private ProgressBar progress() {
        ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(1000);
        bar.setProgress(0);
        return bar;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void createNotificationChannel() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                MonitorJobService.CHANNEL_ID,
                "DAVID hourly reports",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Hourly Enchev Auctions progress reports");
        manager.createNotificationChannel(channel);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
        }
    }
}
