package id.abchospitality.selaras;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
