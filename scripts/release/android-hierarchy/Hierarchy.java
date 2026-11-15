package com.footnation.audit;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.Bundle;
import android.util.Xml;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.File;
import java.io.FileOutputStream;
import org.xmlpull.v1.XmlSerializer;

/** Test-only fresh accessibility snapshot; does not wait for animated UI to idle. */
public final class Hierarchy extends Instrumentation {
  @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
  @Override public void onStart() {
    File output = new File(getContext().getFilesDir(), "hierarchy.xml");
    output.delete();
    Bundle result = new Bundle();
    try {
      UiAutomation automation = getUiAutomation();
      AccessibilityNodeInfo root = automation.getRootInActiveWindow();
      if (root == null) throw new IllegalStateException("No foreground accessibility root");
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
      finish(Activity.RESULT_CANCELED, result);
    }
  }
  private static String value(CharSequence text) { return text == null ? "" : text.toString(); }
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
