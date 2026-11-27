package com.mohleyla.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Stands in for @capacitor/push-notifications in builds made without google-services.json. Without Firebase the real
 * plugin's register() throws, and Capacitor turns that into a crash; here every call just fails with an error.
 * Listeners (addListener / removeListener) come from Plugin and simply never fire.
 */
@CapacitorPlugin(name = "PushNotifications")
public class PushUnavailablePlugin extends Plugin {

    private void fail(PluginCall call) {
        call.unavailable("Push notifications are not set up in this build.");
    }

    @Override
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        fail(call);
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        fail(call);
    }

    @PluginMethod
    public void register(PluginCall call) {
        fail(call);
    }

    @PluginMethod
    public void unregister(PluginCall call) {
        fail(call);
    }

    @PluginMethod
    public void createChannel(PluginCall call) {
        fail(call);
    }
}
