package com.mohleyla.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void load() {
        // load() runs after Capacitor has collected the installed plugins, so a plugin added here with the same name wins.
        bridgeBuilder.addPlugin(PushConfigPlugin.class);
        if (!BuildConfig.PUSH_CONFIGURED) {
            bridgeBuilder.addPlugin(PushUnavailablePlugin.class);
        }
        super.load();
    }
}
