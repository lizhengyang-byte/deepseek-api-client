package com.lizhengyang.deepseekapi;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注册 App 内登录插件（见 WebLoginPlugin.java），必须在 super.onCreate 之前
        registerPlugin(WebLoginPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
