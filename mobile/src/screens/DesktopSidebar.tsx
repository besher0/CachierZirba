// @ts-nocheck
import { ScrollView, Text, View } from "react-native";

import { styles } from "../views/appStyles";
import { useAppShellContext } from "./AppScreenContext";

export function DesktopSidebar() {
  const {
    BRAND_CATEGORY,
    BRAND_NAME,
    Pressable,
    activeScreen,
    isDesktop,
    navItems,
    setActiveScreen,
  } = useAppShellContext();

  return (
    <>
      {isDesktop && (
        <View style={styles.sidebar}>
          <Text style={styles.sidebarBrand}>{BRAND_NAME}</Text>
          <Text style={styles.sidebarSubBrand}>{BRAND_CATEGORY}</Text>
      
          <ScrollView
            style={styles.sidebarNavScroll}
            contentContainerStyle={styles.sidebarNav}
            showsVerticalScrollIndicator={false}
          >
            {navItems.map((item) => {
              const active = activeScreen === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.sidebarNavItem, active && styles.sidebarNavItemActive]}
                  onPress={() => setActiveScreen(item.key)}
                >
                  <Text style={[styles.sidebarNavText, active && styles.sidebarNavTextActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.sidebarNavSubText, active && styles.sidebarNavSubTextActive]}>
                    {item.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
      
          <Pressable style={styles.sidebarActionButton} onPress={() => setActiveScreen('pos')}>
            <Text style={styles.sidebarActionButtonText}>بيع جديد +</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
