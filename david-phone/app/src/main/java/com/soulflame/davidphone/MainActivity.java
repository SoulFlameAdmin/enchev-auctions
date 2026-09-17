package com.soulflame.davidphone;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.speech.RecognizerIntent;
import android.telephony.SmsManager;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int VOICE = 10;
    private static final int PERMS = 11;
    private TextView status;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        box.setPadding(40,80,40,40);
        box.setBackgroundColor(Color.BLACK);

        TextView title = new TextView(this);
        title.setText("DAVID PHONE\nv0.1 · LOCAL · NO GPT");
        title.setGravity(Gravity.CENTER);
        title.setTextColor(Color.WHITE);
        title.setTextSize(28);
        box.addView(title, new LinearLayout.LayoutParams(-1,-2));

        status = new TextView(this);
        status.setText("Натисни ГОВОРИ и кажи команда.\n\nПримери:\n• Отвори Google\n• Отвори Edge\n• Потърси Hover H5\n• Звънни на Борко\n• Прати SMS на Борко: ще закъснея\n• Отвори обажданията");
        status.setTextColor(Color.LTGRAY);
        status.setTextSize(18);
        status.setPadding(0,50,0,35);
        box.addView(status, new LinearLayout.LayoutParams(-1,-2));

        Button permissions = new Button(this);
        permissions.setText("1. Разреши функции");
        permissions.setOnClickListener(v -> requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO,Manifest.permission.READ_CONTACTS,Manifest.permission.CALL_PHONE,Manifest.permission.SEND_SMS}, PERMS));
        box.addView(permissions, new LinearLayout.LayoutParams(-1,-2));

        Button talk = new Button(this);
        talk.setText("🎙 2. ГОВОРИ");
        talk.setTextSize(22);
        talk.setOnClickListener(v -> listen());
        box.addView(talk, new LinearLayout.LayoutParams(-1,-2));
        setContentView(box);
    }

    private void listen() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PERMS);
            status.setText("Разреши микрофона и натисни ГОВОРИ пак.");
            return;
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "bg-BG");
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        startActivityForResult(i, VOICE);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if (requestCode != VOICE || resultCode != RESULT_OK || data == null) return;
        ArrayList<String> r = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (r != null && !r.isEmpty()) runCommand(r.get(0));
    }

    private void runCommand(String heard) {
        String c = heard.toLowerCase(new Locale("bg","BG")).trim().replaceFirst("^(дейвид|девид|david)[, ]*", "");
        status.setText("Чух: “"+heard+"”");

        if (c.contains("потърси")) {
            String q = c.substring(c.indexOf("потърси") + 7).trim();
            if (!q.isEmpty()) { open("https://www.google.com/search?q="+Uri.encode(q)); return; }
        }
        if (c.equals("отвори google") || c.equals("отвори гугъл") || c.equals("отвори браузъра")) { open("https://www.google.com"); return; }
        if (c.equals("отвори edge") || c.equals("отвори едж")) { if (!openPackage("com.microsoft.emmx")) status.setText("Microsoft Edge не е намерен."); return; }
        if (c.equals("отвори обажданията") || c.equals("отвори телефона")) { startActivity(new Intent(Intent.ACTION_DIAL)); return; }
        if (c.startsWith("звънни на ")) { call(c.substring(9).trim()); return; }
        if (c.startsWith("обади се на ")) { call(c.substring(11).trim()); return; }
        if (c.startsWith("прати sms на ") || c.startsWith("прати смс на ")) { sms(c); return; }
        if (c.equals("начало")) {
            Intent h=new Intent(Intent.ACTION_MAIN); h.addCategory(Intent.CATEGORY_HOME); h.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(h); return;
        }
        if (c.startsWith("отвори ")) {
            String name=c.substring(7).trim();
            if (name.contains("maps") || name.contains("карти")) { if(openPackage("com.google.android.apps.maps")) return; }
            if (name.contains("youtube") || name.contains("ютуб")) { if(openPackage("com.google.android.youtube")) return; }
            if (name.contains("spotify") || name.contains("спотифай")) { if(openPackage("com.spotify.music")) return; }
            if (name.contains("viber") || name.contains("вайбър")) { if(openPackage("com.viber.voip")) return; }
            if (name.contains("whatsapp") || name.contains("ватсап")) { if(openPackage("com.whatsapp")) return; }
        }
        status.setText("Още не знам тази команда:\n"+heard);
    }

    private void open(String url) { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
    private boolean openPackage(String pkg) {
        Intent i=getPackageManager().getLaunchIntentForPackage(pkg);
        if(i==null) return false; startActivity(i); return true;
    }

    private String phoneFor(String name) {
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null;
        String[] p={ContactsContract.CommonDataKinds.Phone.NUMBER};
        String s=ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME+" LIKE ?";
        try(Cursor cur=getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,p,s,new String[]{"%"+name+"%"},null)) {
            if(cur!=null && cur.moveToFirst()) return cur.getString(0);
        }
        return null;
    }

    private void call(String name) {
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS)!=PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.CALL_PHONE)!=PackageManager.PERMISSION_GRANTED) {
            status.setText("Разреши Контакти + Телефон и повтори."); return;
        }
        String n=phoneFor(name);
        if(n==null){status.setText("Не намерих контакт: "+name);return;}
        startActivity(new Intent(Intent.ACTION_CALL,Uri.parse("tel:"+Uri.encode(n))));
    }

    private void sms(String c) {
        if (checkSelfPermission(Manifest.permission.READ_CONTACTS)!=PackageManager.PERMISSION_GRANTED || checkSelfPermission(Manifest.permission.SEND_SMS)!=PackageManager.PERMISSION_GRANTED) {
            status.setText("Разреши Контакти + SMS и повтори."); return;
        }
        int at=c.indexOf(" на ");
        String rest=at>=0?c.substring(at+4).trim():"";
        int colon=rest.indexOf(':');
        if(colon<0){status.setText("Кажи: Прати SMS на Борко: ще закъснея");return;}
        String name=rest.substring(0,colon).trim(), text=rest.substring(colon+1).trim();
        String n=phoneFor(name);
        if(n==null){status.setText("Не намерих контакт: "+name);return;}
        SmsManager.getDefault().sendTextMessage(n,null,text,null,null);
        status.setText("SMS изпратен до "+name);
    }
}
