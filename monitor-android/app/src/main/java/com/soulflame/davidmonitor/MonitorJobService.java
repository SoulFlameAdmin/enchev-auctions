package com.soulflame.davidmonitor;

import android.app.JobInfo;
import android.app.JobParameters;
import android.app.JobScheduler;
import android.app.JobService;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;

import java.util.Locale;

public class MonitorJobService extends JobService {
    public static final String CHANNEL_ID = "david_hourly";
    private static final int JOB_ID = 17092026;
    private static final int NOTIFICATION_ID = 607;

    public static void schedule(Context context) {
        JobScheduler scheduler = context.getSystemService(JobScheduler.class);
        if (scheduler == null) return;

        ComponentName service = new ComponentName(context, MonitorJobService.class);
        JobInfo job = new JobInfo.Builder(JOB_ID, service)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(60L * 60L * 1000L)
                .setPersisted(true)
                .build();
        scheduler.schedule(job);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try {
                MonitorClient.Result result = MonitorClient.fetch();
                postReport(result);
            } catch (Exception error) {
                postError(error.getMessage());
            } finally {
                jobFinished(params, false);
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    private void postReport(MonitorClient.Result result) {
        String title = "DAVID · ENCHEV · " + result.verifiedGreen + " GREEN";
        String compact = String.format(Locale.US,
                "%.2f%% global · Wave 0 %.0f%% · next %s",
                result.globalPercent,
                result.wave0Percent,
                result.currentTaskId
        );

        String detail = "Production: HTTP " + result.productionCode
                + "\nNext: " + result.currentTaskId + " · " + result.currentTaskLabel
                + "\nLatest GREEN: " + result.highestVerified
                + "\nCommit: " + result.commitSha + " · " + result.commitMessage;

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle(title)
                .setContentText(compact)
                .setStyle(new Notification.BigTextStyle().bigText(compact + "\n" + detail))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setColor(Color.rgb(45, 186, 105))
                .build();

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, notification);
    }

    private void postError(String message) {
        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle("DAVID Monitor · check failed")
                .setContentText(message == null ? "Unknown error" : message)
                .setAutoCancel(true)
                .build();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, notification);
    }
}
