const { withMainActivity } = require("@expo/config-plugins");

const EVENT_NAME = "externalKeyboardKey";

const ANDROID_IMPORTS = `import android.view.KeyEvent
import android.widget.EditText

import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule`;

const ANDROID_IMPLEMENTATION = `
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val key = mapExternalKeyboardKey(event) ?: return super.dispatchKeyEvent(event)

    // Let focused React Native text fields handle their own keyboard input.
    if (currentFocus is EditText) {
      return super.dispatchKeyEvent(event)
    }

    if (emitExternalKeyboardEvent(key, event)) {
      return true
    }

    return super.dispatchKeyEvent(event)
  }

  private fun mapExternalKeyboardKey(event: KeyEvent): String? {
    return when (event.keyCode) {
      KeyEvent.KEYCODE_0, KeyEvent.KEYCODE_NUMPAD_0 -> "0"
      KeyEvent.KEYCODE_1, KeyEvent.KEYCODE_NUMPAD_1 -> "1"
      KeyEvent.KEYCODE_2, KeyEvent.KEYCODE_NUMPAD_2 -> "2"
      KeyEvent.KEYCODE_3, KeyEvent.KEYCODE_NUMPAD_3 -> "3"
      KeyEvent.KEYCODE_4, KeyEvent.KEYCODE_NUMPAD_4 -> "4"
      KeyEvent.KEYCODE_5, KeyEvent.KEYCODE_NUMPAD_5 -> "5"
      KeyEvent.KEYCODE_6, KeyEvent.KEYCODE_NUMPAD_6 -> "6"
      KeyEvent.KEYCODE_7, KeyEvent.KEYCODE_NUMPAD_7 -> "7"
      KeyEvent.KEYCODE_8, KeyEvent.KEYCODE_NUMPAD_8 -> "8"
      KeyEvent.KEYCODE_9, KeyEvent.KEYCODE_NUMPAD_9 -> "9"
      KeyEvent.KEYCODE_PERIOD,
      KeyEvent.KEYCODE_COMMA,
      KeyEvent.KEYCODE_NUMPAD_DOT -> "."
      KeyEvent.KEYCODE_DEL, KeyEvent.KEYCODE_FORWARD_DEL -> "BACKSPACE"
      KeyEvent.KEYCODE_ESCAPE, KeyEvent.KEYCODE_CLEAR -> "CLEAR"
      else -> {
        val digit = Character.digit(event.unicodeChar.toChar(), 10)
        if (digit in 0..9) digit.toString() else null
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun emitExternalKeyboardEvent(key: String, event: KeyEvent): Boolean {
    val reactApplication = application as ReactApplication
    val reactContext = reactApplication.reactHost?.currentReactContext
      ?: reactApplication.reactNativeHost.reactInstanceManager.currentReactContext
      ?: return false

    val payload = Arguments.createMap().apply {
      putString("key", key)
      putString(
        "action",
        if (event.action == KeyEvent.ACTION_UP) "up" else "down"
      )
      putInt("repeatCount", event.repeatCount)
    }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("${EVENT_NAME}", payload)

    return true
  }
`;

function addImports(contents) {
  if (contents.includes("import android.view.KeyEvent")) {
    return contents;
  }

  return contents.replace(
    "import android.os.Bundle",
    `import android.os.Bundle\n${ANDROID_IMPORTS}`,
  );
}

function addImplementation(contents) {
  if (contents.includes(`EXTERNAL_KEYBOARD_EVENT = "${EVENT_NAME}"`)) {
    return contents;
  }

  const classDeclaration = "class MainActivity : ReactActivity() {";
  const withMethods = contents.replace(
    classDeclaration,
    `${classDeclaration}${ANDROID_IMPLEMENTATION}`,
  );

  const classEnd = withMethods.lastIndexOf("}");
  if (classEnd === -1) {
    throw new Error("Could not find the end of MainActivity.kt");
  }

  return `${withMethods.slice(0, classEnd)}
  companion object {
    private const val EXTERNAL_KEYBOARD_EVENT = "${EVENT_NAME}"
  }
${withMethods.slice(classEnd)}`;
}

module.exports = function withExternalKeyboard(config) {
  return withMainActivity(config, (modConfig) => {
    if (modConfig.modResults.language !== "kt") {
      throw new Error("External keyboard support requires a Kotlin MainActivity.");
    }

    modConfig.modResults.contents = addImplementation(
      addImports(modConfig.modResults.contents),
    );

    return modConfig;
  });
};
