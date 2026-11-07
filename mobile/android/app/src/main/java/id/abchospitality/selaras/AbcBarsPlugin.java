package id.abchospitality.selaras;

import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mewarnai area status bar (atas) & navigation bar (bawah) sama dengan latar aplikasi,
 * supaya tidak ada "celah" berwarna lain di Android. Dipanggil dari web:
 *   Capacitor.Plugins.AbcBars.set({ color: '#F5F6FC', dark: false })
 */
@CapacitorPlugin(name = "AbcBars")
public class AbcBarsPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        String hex = call.getString("color", "#F5F6FC");
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        final int color;
        try {
            color = Color.parseColor(hex);
        } catch (Exception e) {
            call.reject("Warna tidak valid: " + hex);
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (getActivity() instanceof MainActivity) {
                ((MainActivity) getActivity()).applySystemBars(color, dark, true);
            }
            call.resolve();
        });
    }
}
