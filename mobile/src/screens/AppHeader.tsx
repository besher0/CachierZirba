// @ts-nocheck
import { Text, View } from "react-native";

import { styles } from "../views/appStyles";
import { useAppShellContext } from "./AppScreenContext";

export function AppHeader() {
  const {
    BRAND_FULL,
    BRAND_NAME,
    Pressable,
    activeScreen,
    formatMoney,
    isAdmin,
    isDesktop,
    isMobileNavOpen,
    isOnline,
    lastTwoCompletedSalesOrders,
    logout,
    session,
    setActiveScreen,
    toggleMobileNav,
  } = useAppShellContext();
  const recentOrderLabels = ["آخر طلب", "الطلب السابق"];
  const showRecentSales =
    activeScreen === "pos" && lastTwoCompletedSalesOrders.length > 0;

  return (
    <View style={[styles.headerRow, !isDesktop && styles.headerRowMobile]}>
      <View style={styles.userBlock}>
        <Text style={[styles.title, !isDesktop && styles.titleMobile]}>{BRAND_NAME}</Text>
        <Text style={[styles.subtitleBrand, !isDesktop && styles.subtitleBrandMobile]}>{BRAND_FULL}</Text>
        <Text style={[styles.subtitle, !isDesktop && styles.subtitleMobile]}>مرحباً {session.user.displayName}</Text>
        <Text style={[styles.subtitleSmall, !isDesktop && styles.subtitleSmallMobile]}>
          {isAdmin ? 'صلاحية: إدارة عامة' : 'صلاحية: كاشير فرع'}
        </Text>
        {showRecentSales && (
          <View
            style={[
              styles.recentSalesBox,
              !isDesktop && styles.recentSalesBoxMobile,
            ]}
          >
            {lastTwoCompletedSalesOrders.map((order, index) => (
              <View key={order.clientOrderId} style={styles.recentSalesLine}>
                <Text
                  style={[
                    styles.recentSalesLabel,
                    !isDesktop && styles.recentSalesLabelMobile,
                  ]}
                  numberOfLines={1}
                >
                  {recentOrderLabels[index]}:
                </Text>
                <Text
                  style={[
                    styles.recentSalesValue,
                    !isDesktop && styles.recentSalesValueMobile,
                  ]}
                  numberOfLines={1}
                >
                  {formatMoney(order.total)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={[styles.headerActions, !isDesktop && styles.headerActionsMobile]}>
        <View
          style={[
            styles.badge,
            !isDesktop && styles.badgeMobile,
            isOnline ? styles.badgeOnline : styles.badgeOffline,
          ]}
        >
          <Text style={[styles.badgeText, !isDesktop && styles.badgeTextMobile]}>
            {isOnline ? 'متصل' : 'أوفلاين'}
          </Text>
        </View>
        {!isDesktop && (
          <Pressable
            style={[
              styles.mobileNavButton,
              !isDesktop && styles.headerActionButtonMobile,
              isMobileNavOpen && styles.mobileNavButtonActive,
            ]}
            onPress={toggleMobileNav}
          >
            <Text
              style={[
                styles.mobileNavButtonText,
                !isDesktop && styles.headerActionButtonTextMobile,
                isMobileNavOpen && styles.mobileNavButtonTextActive,
              ]}
            >
              {isMobileNavOpen ? '✕ إغلاق الصفحات' : '☰ الصفحات'}
            </Text>
          </Pressable>
        )}
        {isAdmin && (
          <Pressable
            style={[styles.adminButton, !isDesktop && styles.headerActionButtonMobile]}
            onPress={() => setActiveScreen('admin')}
          >
            <Text style={[styles.adminButtonText, !isDesktop && styles.headerActionButtonTextMobile]}>
              لوحة التسوية
            </Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.logoutButton, !isDesktop && styles.headerActionButtonMobile]}
          onPress={() => logout('تم تسجيل الخروج بنجاح.')}
        >
          <Text style={[styles.logoutButtonText, !isDesktop && styles.headerActionButtonTextMobile]}>
            خروج
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
