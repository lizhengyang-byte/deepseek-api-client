package com.lizhengyang.deepseekapi;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * App 内登录插件：
 * 打开官方登录页（chat.deepseek.com），等用户完成登录后，从页面 localStorage 里读出
 * userToken 回传给前端。插件不采集账号密码，也不做任何账号操作，只做「令牌搬运」。
 */
@CapacitorPlugin(name = "WebLogin")
public class WebLoginPlugin extends Plugin {

    private static final String LOGIN_URL = "https://chat.deepseek.com/sign_in";
    private static final long WATCH_MS = 700;

    private Dialog dialog;
    private WebView webView;
    private PluginCall pendingCall;
    private boolean tokenSent;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void login(PluginCall call) {
        if (pendingCall != null) {
            call.reject("已经有一个登录页在打开中");
            return;
        }
        pendingCall = call;
        tokenSent = false;
        getActivity().runOnUiThread(() -> showLoginDialog(getActivity()));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showLoginDialog(Activity activity) {
        webView = new WebView(activity);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " DeepSeekAPIApp/1.0");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new TokenBridge(), "DSBridge");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(PAYLOAD, null);
            }
        });

        LinearLayout container = new LinearLayout(activity);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setBackgroundColor(Color.WHITE);
        container.addView(
            webView,
            new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );

        dialog = new Dialog(activity);
        dialog.setContentView(container, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        dialog.setCanceledOnTouchOutside(false);
        dialog.setOnCancelListener(d -> finishCancelled());
        dialog.show();
        webView.loadUrl(LOGIN_URL);
    }

    private static final String PAYLOAD =
        "(function(){"
            + "if(window.__dsTokenWatcher){return;}window.__dsTokenWatcher=true;"
            + "var tick=function(){"
            + "try{"
            + "var t=window.localStorage.getItem('userToken')||window.localStorage.getItem('token');"
            + "if(t&&window.DSBridge&&window.DSBridge.post){window.DSBridge.post(t);}"
            + "}catch(e){}"
            + "};"
            + "setInterval(tick," + WATCH_MS + ");tick();"
            + "})();";

    private class TokenBridge {
        @JavascriptInterface
        public void post(String token) {
            if (token == null || token.trim().isEmpty() || tokenSent) return;
            tokenSent = true;
            final String value = token.trim();
            final Activity activity = getActivity();
            if (activity == null) return;
            activity.runOnUiThread(() -> {
                if (pendingCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("token", value);
                    pendingCall.resolve(ret);
                    pendingCall = null;
                }
                closeDialog();
            });
        }
    }

    private void finishCancelled() {
        if (pendingCall != null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            pendingCall.resolve(ret);
            pendingCall = null;
        }
        closeDialog();
    }

    private void closeDialog() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        if (dialog != null) {
            dialog.dismiss();
            dialog = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        finishCancelled();
        super.handleOnDestroy();
    }
}
