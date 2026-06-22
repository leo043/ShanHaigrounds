package com.lushi.shanhai;

import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 在 super.onCreate 之前设置窗口，确保 WebView 创建时已经是沉浸式
        Window window = getWindow();
        // Edge-to-edge：让内容延伸到状态栏/导航栏/刘海区域下方
        WindowCompat.setDecorFitsSystemWindows(window, false);
        // 透明系统栏（让背景透出，配合 CSS env(safe-area-inset-*) 处理内容避让）
        window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
        window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        // 旧版 API 也设置 FLAG，确保 Android 5.0+ 都生效
        window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);

        super.onCreate(savedInstanceState);

        // 沉浸式：隐藏状态栏和导航栏，滑动可短暂唤出
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // 切换应用、旋转屏幕等场景下重新进入沉浸式
        if (hasFocus) {
            Window window = getWindow();
            WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(window, window.getDecorView());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }
    }
}
