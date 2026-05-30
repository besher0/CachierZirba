import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";

import { BRAND_NAME } from "../support/appSupport";
import { styles } from "../views/appStyles";
import { AppBackdrop } from "./AppBackdrop";

export function BootScreen() {
  return (
    <View style={styles.flexOne}>
      <View style={styles.bootRoot}>
        <StatusBar style="dark" />
        <AppBackdrop />
        <ActivityIndicator size="large" color="#ec4899" />
        <Text style={styles.bootText}>يتم تجهيز نظام {BRAND_NAME}...</Text>
      </View>
    </View>
  );
}
