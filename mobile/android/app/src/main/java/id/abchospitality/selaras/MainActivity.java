package id.abchospitality.selaras;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /* Biarkan JavaScript tetap berjalan saat aplikasi di latar belakang,
       supaya cek notifikasi baru (tiap ~15 detik) tetap jalan dan
       pemberitahuan langsung masuk ke bilah notifikasi Android. */
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
