// @ts-nocheck
import { Text, View } from "react-native";

import { styles } from "../views/appStyles";
import { useAppShellContext } from "./AppScreenContext";

export function MobilePageIndicator() {
  const { activeScreenLabel, showPageSwitchControls } = useAppShellContext();

  return (
    <>
      {showPageSwitchControls && (
        <View style={styles.mobilePageRow}>
          <Text style={styles.mobilePageCurrentText}>{activeScreenLabel}</Text>
        </View>
      )}
    </>
  );
}
