import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";

import { TapSoundContext } from "./src/components/TapPressable";
import { useAppController } from "./src/controllers/useAppController";
import { styles } from "./src/views/appStyles";
import { AppScreenContext } from "./src/screens/AppScreenContext";
import { ActiveScreenContent } from "./src/screens/ActiveScreenContent";
import { AppBackdrop } from "./src/screens/AppBackdrop";
import { AppHeader } from "./src/screens/AppHeader";
import { AppOverlays } from "./src/screens/AppOverlays";
import { BootScreen } from "./src/screens/BootScreen";
import { DesktopSidebar } from "./src/screens/DesktopSidebar";
import { LoginScreen } from "./src/screens/LoginScreen";
import { MobilePageIndicator } from "./src/screens/MobilePageIndicator";
import { StoreSwitcher } from "./src/screens/StoreSwitcher";

export default function App() {
  const {
    appScreenContext,
    isBootstrapping,
    session,
    playTapSound,
    isDesktop,
    isPortraitMobile,
    swipePanResponder,
    isPosProductReordering,
  } = useAppController();

  if (isBootstrapping) {
    return (
      <TapSoundContext.Provider value={playTapSound}>
        <BootScreen />
      </TapSoundContext.Provider>
    );
  }

  if (!session) {
    return (
      <TapSoundContext.Provider value={playTapSound}>
        <AppScreenContext.Provider value={appScreenContext}>
          <LoginScreen />
        </AppScreenContext.Provider>
      </TapSoundContext.Provider>
    );
  }

  return (
    <TapSoundContext.Provider value={playTapSound}>
      <AppScreenContext.Provider value={appScreenContext}>
        <View style={styles.flexOne}>
          <View style={styles.appRoot}>
            <StatusBar style="dark" />
            <AppBackdrop />

            <View style={[styles.shell, !isDesktop && styles.shellMobile]}>
              <View
                style={[
                  styles.mainPane,
                  !isDesktop && styles.mainPaneMobile,
                  isPortraitMobile && styles.mainPanePortraitMobile,
                ]}
                {...swipePanResponder.panHandlers}
              >
                <AppHeader />
                <StoreSwitcher />
                <MobilePageIndicator />

                <ScrollView
                  contentContainerStyle={styles.content}
                  scrollEnabled={!isPosProductReordering}
                >
                  <ActiveScreenContent />
                </ScrollView>
              </View>

              <DesktopSidebar />
            </View>

            <AppOverlays />
          </View>
        </View>
      </AppScreenContext.Provider>
    </TapSoundContext.Provider>
  );
}
