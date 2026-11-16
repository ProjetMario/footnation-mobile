package com.footnation.audit;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.InputDevice;
import android.util.Xml;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.File;
import java.io.FileOutputStream;
import org.xmlpull.v1.XmlSerializer;

/** Test-only fresh accessibility snapshot; does not wait for animated UI to idle. */
public final class Hierarchy extends Instrumentation {
  private String tapDescription;
  @Override public void onCreate(Bundle arguments) {
    super.onCreate(arguments);
    tapDescription = arguments == null ? null : arguments.getString("tapDescription");
    start();
  }
  @Override public void onStart() {
    File output = new File(getContext().getFilesDir(), "hierarchy.xml");
    output.delete();
    Bundle result = new Bundle();
    try {
      UiAutomation automation = getUiAutomation();
      AccessibilityNodeInfo root = automation.getRootInActiveWindow();
      for (int attempt=0; root == null && attempt<30; attempt++) {
        Thread.sleep(100);
        root = automation.getRootInActiveWindow();
      }
      if (root == null) throw new IllegalStateException("No foreground accessibility root");
      if (tapDescription != null) {
        if (!java.util.Arrays.asList("Clubs", "Opportunités", "Matches", "Matchs").contains(tapDescription))
          throw new IllegalArgumentException("Unexpected test destination");
        Rect target = null;
        // UiAutomation may initially expose a cached window before its app
        // hierarchy arrives. Refresh until the real target is present.
        for (int attempt=0; target == null && attempt<25; attempt++) {
          root.refresh();
          target = findTarget(root, tapDescription, 0);
          if (target == null) {
            Thread.sleep(80);
            AccessibilityNodeInfo fresh = automation.getRootInActiveWindow();
            if (fresh != null) { root.recycle(); root = fresh; }
          }
        }
        if (target == null) throw new IllegalStateException("Visible navigation target unavailable");
        long now = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, target.centerX(), target.centerY(), 0);
        MotionEvent up = MotionEvent.obtain(now, now + 70, MotionEvent.ACTION_UP, target.centerX(), target.centerY(), 0);
        down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
          if (!automation.injectInputEvent(down, true) || !automation.injectInputEvent(up, true))
            throw new IllegalStateException("Native touch injection failed");
          result.putString("auditAction", "true");
        } finally { down.recycle(); up.recycle(); }
      }
      try (FileOutputStream stream = new FileOutputStream(output)) {
        XmlSerializer xml = Xml.newSerializer();
        xml.setOutput(stream, "UTF-8"); xml.startDocument("UTF-8", true);
        xml.startTag(null, "hierarchy"); write(xml, root, 0); xml.endTag(null, "hierarchy");
        xml.endDocument();
      }
      root.recycle(); result.putString("auditSuccess", "true");
      finish(Activity.RESULT_OK, result);
    } catch (Exception error) {
      output.delete(); result.putString("auditSuccess", "false");
      result.putString("auditFailure", error.getClass().getSimpleName() + ": " + error.getMessage());
      finish(Activity.RESULT_CANCELED, result);
    }
  }
  private static String value(CharSequence text) { return text == null ? "" : text.toString(); }
  private static Rect findTarget(AccessibilityNodeInfo node, String description, int depth) {
    if (depth > 80) return null;
    if (node.isVisibleToUser() && node.isClickable() && description.equals(value(node.getContentDescription()))
        && "com.footnation.app".equals(value(node.getPackageName()))) {
      Rect frame = new Rect(); node.getBoundsInScreen(frame);
      // Use the current visible intersection; never tap stale/offscreen bounds
      // obtained before the continuously moving navigation rail advanced.
      if (frame.intersect(0, 90, 1080, 1860) && frame.width() >= 80 && frame.height() >= 35) return frame;
    }
    for (int i = 0; i < node.getChildCount(); i++) {
      AccessibilityNodeInfo child = node.getChild(i);
      if (child != null) {
        Rect found = findTarget(child, description, depth + 1); child.recycle();
        if (found != null) return found;
      }
    }
    return null;
  }
  private static void write(XmlSerializer xml, AccessibilityNodeInfo node, int depth) throws Exception {
    if (depth > 80) return;
    Rect bounds = new Rect(); node.getBoundsInScreen(bounds);
    xml.startTag(null, "node");
    xml.attribute(null, "text", value(node.getText()));
    xml.attribute(null, "content-desc", value(node.getContentDescription()));
    xml.attribute(null, "class", value(node.getClassName()));
    xml.attribute(null, "package", value(node.getPackageName()));
    xml.attribute(null, "bounds", "[" + bounds.left + "," + bounds.top + "][" + bounds.right + "," + bounds.bottom + "]");
    xml.attribute(null, "clickable", String.valueOf(node.isClickable()));
    xml.attribute(null, "selected", String.valueOf(node.isSelected()));
    xml.attribute(null, "visible-to-user", String.valueOf(node.isVisibleToUser()));
    for (int i=0; i<node.getChildCount(); i++) {
      AccessibilityNodeInfo child = node.getChild(i);
      if (child != null) { write(xml, child, depth+1); child.recycle(); }
    }
    xml.endTag(null, "node");
  }
}
