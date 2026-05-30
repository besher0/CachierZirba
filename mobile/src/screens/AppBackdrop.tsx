import { View } from "react-native";

import { styles } from "../views/appStyles";

export function AppBackdrop() {
  return (
    <View style={[styles.pastelBackdrop, styles.noPointerEvents]}>
      <View style={[styles.pastelBlob, styles.pastelBlobBlueTop]} />
      <View style={[styles.pastelBlob, styles.pastelBlobPinkRight]} />
      <View style={[styles.pastelBlob, styles.pastelBlobBlueBottom]} />
      <View style={[styles.pastelDot, styles.pastelDotOne]} />
      <View style={[styles.pastelDot, styles.pastelDotTwo]} />
      <View style={[styles.pastelDot, styles.pastelDotThree]} />
      <View style={[styles.pastelDot, styles.pastelDotFour]} />
      <View style={[styles.pastelDot, styles.pastelDotFive]} />
      <View style={[styles.pastelDot, styles.pastelDotSix]} />
      <View style={[styles.pastelDot, styles.pastelDotSeven]} />
      <View style={[styles.pastelDot, styles.pastelDotEight]} />
    </View>
  );
}
