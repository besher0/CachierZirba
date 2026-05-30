// @ts-nocheck
import { Text, View } from "react-native";

import { styles } from "../views/appStyles";
import { useAppScreenContext } from "./AppScreenContext";

export function MobilePageIndicator() {
  const { activeScreenLabel, showPageSwitchControls } = useAppScreenContext();

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
