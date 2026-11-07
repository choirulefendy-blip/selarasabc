package id.abchospitality.selaras;

import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String BAR_PREFS = "abc_system_bars";
    private int barColor = 0;
    private boolean barDark = false;
    private boolean barSet = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AbcBarsPlugin.class);
        super.onCreate(savedInstanceState);
        /* Warna status bar & navigation bar terakhir (terang/gelap) dipakai sejak aplikasi dibuka. */
        try {
            SharedPreferences sp = getSharedPreferences(BAR_PREFS, MODE_PRIVATE);
            if (sp.contains("color")) applySystemBars(sp.getInt("color", Color.parseColor("#F5F6FC")), sp.getBoolean("dark", false), false);
        } catch (Exception ignored) { }
        /* Tombol Back HP: biarkan aplikasi kembali ke layar sebelumnya.
           Kalau sudah di halaman awal, aplikasi diminimalkan (tidak ditutup). */
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                try {
                    WebView wv = bridge != null ? bridge.getWebView() : null;
                    if (wv == null) { moveTaskToBack(true); return; }
                    wv.evaluateJavascript("(window.__abcBack ? window.__abcBack() : 'no')", value -> {
                        if (value == null || !value.contains("ok")) moveTaskToBack(true);
                    });
                } catch (Exception e) {
                    moveTaskToBack(true);
                }
            }
        });
    }

    /** Area status bar (atas) & navigation bar (bawah) diberi warna yang sama dengan latar aplikasi. */
    public void applySystemBars(int color, boolean dark, boolean persist) {
        try {
            barColor = color; barDark = dark; barSet = true;
            Window w = getWindow();
            w.getDecorView().setBackgroundColor(color);
            w.setStatusBarColor(color);
            w.setNavigationBarColor(color);
            if (android.os.Build.VERSION.SDK_INT >= 29) {
                w.setNavigationBarContrastEnforced(false);
                w.setStatusBarContrastEnforced(false);
            }
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
            c.setAppearanceLightStatusBars(!dark);
            c.setAppearanceLightNavigationBars(!dark);
            if (persist) {
                getSharedPreferences(BAR_PREFS, MODE_PRIVATE).edit().putInt("color", color).putBoolean("dark", dark).apply();
            }
        } catch (Exception ignored) { }
    }

    /* Plugin SystemBars bawaan mengembalikan warna saat konfigurasi berubah (rotasi, tema sistem): pasang lagi. */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (barSet) applySystemBars(barColor, barDark, false);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (barSet) applySystemBars(barColor, barDark, false);
    }

    /* Biarkan JavaScript tetap berjalan saat aplikasi di latar belakang,
       supaya cek notifikasi baru tetap jalan. */
    @Override
    public void onPause() {
        super.onPause();
        try {
            if (bridge != null && bridge.getWebView() != null) {
                WebView wv = bridge.getWebView();
                wv.onResume();
                wv.resumeTimers();
            }
        } catch (Exception ignored) { }
    }
}
