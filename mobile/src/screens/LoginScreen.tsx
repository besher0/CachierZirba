// @ts-nocheck
import { StatusBar } from "expo-status-bar";
import { Text, TextInput, View } from "react-native";

import { BRAND_CATEGORY, BRAND_NAME, BRAND_SIGNATURE } from "../support/appSupport";
import { Pressable } from "../components/TapPressable";
import { API_BASE_URL } from "../config";
import { styles } from "../views/appStyles";
import { AppBackdrop } from "./AppBackdrop";
import { useAppScreenContext } from "./AppScreenContext";

export function LoginScreen() {
  const {
    isLoggingIn,
    loginUser,
    passwordInput,
    setPasswordInput,
    setUsernameInput,
    statusMessage,
    usernameInput,
  } = useAppScreenContext();

  return (
    <View style={styles.flexOne}>
      <View style={styles.loginRoot}>
        <StatusBar style="dark" />
        <AppBackdrop />
        <View style={styles.loginCircleOne} />
        <View style={styles.loginCircleTwo} />
        <View style={styles.loginCard}>
          <Text style={styles.loginBrand}>{BRAND_NAME}</Text>
          <Text style={styles.loginTitle}>{BRAND_SIGNATURE}</Text>
          <Text style={styles.loginHint}>
            {BRAND_CATEGORY} - استخدم حساب الإدارة أو الكاشير المرتبط بالفرع
          </Text>
          <Text style={styles.loginApiHint}>API: {API_BASE_URL}</Text>
    
          <TextInput
            style={styles.loginInput}
            value={usernameInput}
            onChangeText={setUsernameInput}
            placeholder="اسم المستخدم"
            placeholderTextColor="#c092b3"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.loginInput}
            value={passwordInput}
            onChangeText={setPasswordInput}
            placeholder="كلمة المرور"
            placeholderTextColor="#c092b3"
            secureTextEntry
          />
    
          <Pressable
            style={styles.loginButton}
            onPress={() => void loginUser()}
            disabled={isLoggingIn}
          >
            <Text style={styles.loginButtonText}>{isLoggingIn ? 'جاري الدخول...' : 'دخول'}</Text>
          </Pressable>
    
          <View style={styles.loginDemoBox}>
            <Text style={styles.loginDemoTitle}>حسابات تجريبية</Text>
            <Text style={styles.loginDemoText}>مها / abcd</Text>
            <Text style={styles.loginDemoText}>محافظة / 0000</Text>
            <Text style={styles.loginDemoText}>فرقان / 1111</Text>
            <Text style={styles.loginDemoText}>اندلس / 5555</Text>
          </View>
    
          <Text style={styles.loginStatus}>{statusMessage}</Text>
        </View>
      </View>
    </View>
  );
}
