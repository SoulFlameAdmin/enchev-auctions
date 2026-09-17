package com.soulflame.davidmonitor;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class MonitorClient {
    private static final String PLAN_URL = "https://raw.githubusercontent.com/SoulFlameAdmin/enchev-auctions/main/app/components/MasterSystemPlanV1.tsx";
    private static final String VERIFIED_URL = "https://raw.githubusercontent.com/SoulFlameAdmin/enchev-auctions/main/app/components/VerifiedPlanEvidenceSync.tsx";
    private static final String COMMITS_URL = "https://api.github.com/repos/SoulFlameAdmin/enchev-auctions/commits?per_page=1";
    private static final String PRODUCTION_URL = "https://enchev-auctions.vercel.app";

    private MonitorClient() {}

    public static Result fetch() throws Exception {
        String planSource = fetchText(PLAN_URL);
        String verifiedSource = fetchText(VERIFIED_URL);

        int totalTasks = 0;
        int wave0Total = 0;
        Map<String, String> wave0Labels = new HashMap<>();

        Pattern phasePattern = Pattern.compile("\\[\\\"(\\d{2})\\\",\\\"([^\\\"]+)\\\",\\[(.*?)\\]\\]", Pattern.DOTALL);
        Matcher phaseMatcher = phasePattern.matcher(planSource);
        Pattern taskPattern = Pattern.compile("\\\"([^\\\"]+)\\\"");

        while (phaseMatcher.find()) {
            String phaseId = phaseMatcher.group(1);
            String taskBlock = phaseMatcher.group(3);
            Matcher taskMatcher = taskPattern.matcher(taskBlock);
            int index = 1;
            while (taskMatcher.find()) {
                String spec = taskMatcher.group(1);
                String label = spec.split("\\|", -1)[0];
                totalTasks++;
                if ("00".equals(phaseId)) {
                    wave0Total++;
                    wave0Labels.put(String.format(Locale.US, "00.%02d", index), label);
                }
                index++;
            }
        }

        Set<String> verifiedIds = new HashSet<>();
        Map<String, String> evidenceById = new HashMap<>();
        Pattern verifiedPattern = Pattern.compile("\\\"(\\d{2}\\.\\d{2})\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
        Matcher verifiedMatcher = verifiedPattern.matcher(verifiedSource);
        while (verifiedMatcher.find()) {
            verifiedIds.add(verifiedMatcher.group(1));
            evidenceById.put(verifiedMatcher.group(1), verifiedMatcher.group(2));
        }

        int wave0Green = 0;
        String currentTaskId = "—";
        String currentTaskLabel = "Всички Wave 0 задачи са доказани";
        for (int i = 1; i <= wave0Total; i++) {
            String id = String.format(Locale.US, "00.%02d", i);
            if (verifiedIds.contains(id)) {
                wave0Green++;
            } else if ("—".equals(currentTaskId)) {
                currentTaskId = id;
                currentTaskLabel = wave0Labels.containsKey(id) ? wave0Labels.get(id) : "Следваща зависима задача";
            }
        }

        String highestVerified = "—";
        String highestEvidence = "Няма доказано GREEN evidence";
        for (String id : verifiedIds) {
            if ("—".equals(highestVerified) || id.compareTo(highestVerified) > 0) {
                highestVerified = id;
                highestEvidence = evidenceById.get(id);
            }
        }

        String commitJson = fetchText(COMMITS_URL);
        JSONArray commits = new JSONArray(commitJson);
        String commitSha = "—";
        String commitMessage = "—";
        String commitDate = "—";
        if (commits.length() > 0) {
            JSONObject item = commits.getJSONObject(0);
            commitSha = item.optString("sha", "—");
            if (commitSha.length() > 8) commitSha = commitSha.substring(0, 8);
            JSONObject commit = item.optJSONObject("commit");
            if (commit != null) {
                commitMessage = commit.optString("message", "—").split("\\n", 2)[0];
                JSONObject author = commit.optJSONObject("author");
                if (author != null) commitDate = author.optString("date", "—");
            }
        }

        int productionCode = fetchStatus(PRODUCTION_URL);
        double globalPercent = totalTasks == 0 ? 0.0 : (verifiedIds.size() * 100.0 / totalTasks);
        double wave0Percent = wave0Total == 0 ? 0.0 : (wave0Green * 100.0 / wave0Total);

        Result result = new Result();
        result.totalTasks = totalTasks;
        result.verifiedGreen = verifiedIds.size();
        result.globalPercent = globalPercent;
        result.wave0Total = wave0Total;
        result.wave0Green = wave0Green;
        result.wave0Percent = wave0Percent;
        result.currentTaskId = currentTaskId;
        result.currentTaskLabel = currentTaskLabel;
        result.highestVerified = highestVerified;
        result.highestEvidence = highestEvidence;
        result.commitSha = commitSha;
        result.commitMessage = commitMessage;
        result.commitDate = commitDate;
        result.productionCode = productionCode;
        return result;
    }

    private static String fetchText(String urlValue) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlValue).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("User-Agent", "DAVID-Monitor/1.0");
        connection.setRequestProperty("Accept", "application/vnd.github+json, text/plain, */*");
        connection.setInstanceFollowRedirects(true);

        int code = connection.getResponseCode();
        InputStream stream = code >= 200 && code < 400 ? connection.getInputStream() : connection.getErrorStream();
        if (stream == null) throw new IllegalStateException("HTTP " + code + " for " + urlValue);

        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) out.append(line).append('\n');
        } finally {
            connection.disconnect();
        }
        if (code < 200 || code >= 400) throw new IllegalStateException("HTTP " + code + " for " + urlValue);
        return out.toString();
    }

    private static int fetchStatus(String urlValue) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(urlValue).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("User-Agent", "DAVID-Monitor/1.0");
            connection.setInstanceFollowRedirects(true);
            return connection.getResponseCode();
        } catch (Exception ignored) {
            return -1;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    public static final class Result {
        public int totalTasks;
        public int verifiedGreen;
        public double globalPercent;
        public int wave0Total;
        public int wave0Green;
        public double wave0Percent;
        public String currentTaskId;
        public String currentTaskLabel;
        public String highestVerified;
        public String highestEvidence;
        public String commitSha;
        public String commitMessage;
        public String commitDate;
        public int productionCode;
    }
}
