import { StatusBar } from "expo-status-bar";
import { RefreshControl, ScrollView, View } from "react-native";

import { TapSoundContext } from "./src/components/TapPressable";
import { useAppController } from "./src/controllers/useAppController";
import { styles } from "./src/views/appStyles";
import {
  AppScreenContext,
  AppShellContext,
} from "./src/screens/AppScreenContext";
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
    appShellContext,
    isBootstrapping,
    session,
    playTapSound,
    isDesktop,
    isPortraitMobile,
    swipePanResponder,
    isPosProductReordering,
    isRefreshingActiveScreen,
    refreshActiveScreenData,
  } = useAppController();
  const activeScreenUsesVirtualizedList = [
    "orders",
    "expenses",
    "purchases",
    "settlement",
  ].includes(
    appScreenContext.activeScreen as string,
  );

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
      <AppShellContext.Provider value={appShellContext}>
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
                {appScreenContext.activeScreen !== "pos" && <StoreSwitcher />}
                <MobilePageIndicator />

                {activeScreenUsesVirtualizedList ? (
                  <ActiveScreenContent />
                ) : (
                  <ScrollView
                    contentContainerStyle={styles.content}
                    scrollEnabled={!isPosProductReordering}
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshingActiveScreen}
                        onRefresh={() =>
                          void refreshActiveScreenData({
                            force: true,
                            showIndicator: true,
                          })
                        }
                        tintColor="#831843"
                        colors={["#831843"]}
                      />
                    }
                  >
                    <ActiveScreenContent />
                  </ScrollView>
                )}
              </View>

              <DesktopSidebar />
            </View>

            <AppOverlays />
          </View>
        </View>
        </AppScreenContext.Provider>
      </AppShellContext.Provider>
    </TapSoundContext.Provider>
  );
}
