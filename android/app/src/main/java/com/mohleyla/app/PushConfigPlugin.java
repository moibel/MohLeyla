package com.mohleyla.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Tells the web side whether this build was made with Firebase (google-services.json), so it can hide the push switch. */
@CapacitorPlugin(name = "PushConfig")
public class PushConfigPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", BuildConfig.PUSH_CONFIGURED);
        call.resolve(result);
    }
}
