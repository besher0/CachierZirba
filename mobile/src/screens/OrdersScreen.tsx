// @ts-nocheck
import { FlatList } from "react-native";

import { useAppScreenContext } from "./AppScreenContext";

export function OrdersScreen() {
  const {
    Pressable,
    Text,
    View,
    formatMoney,
    isRefreshingActiveScreen,
    mergedOrderRows,
    refreshActiveScreenData,
    section,
    sectionHeaderInline,
    sectionTitle,
    setSelectedOrderInvoice,
    smallRefreshButton,
    smallRefreshText,
    styles,
    toOrderStatusLabel,
    toShortDate,
  } = useAppScreenContext() as any;

  return (
    <FlatList
      style={styles.flexOne}
      contentContainerStyle={styles.content}
      data={mergedOrderRows}
      keyExtractor={(order) => order.clientOrderId}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      removeClippedSubviews
      updateCellsBatchingPeriod={50}
      windowSize={7}
      refreshing={isRefreshingActiveScreen}
      onRefresh={() =>
        void refreshActiveScreenData({ force: true, showIndicator: true })
      }
      renderItem={({ item: order }) => (
        <Pressable
          style={styles.orderRow}
          onPress={() => setSelectedOrderInvoice(order)}
        >
          <View style={styles.orderRowMain}>
            <Text style={styles.orderRowId}>{order.clientOrderId}</Text>
            <Text style={styles.orderRowItems}>
              {toOrderStatusLabel(order.status)} - {order.itemsCount} عناصر
            </Text>
          </View>
          <View style={styles.orderRowMain}>
            <Text style={styles.orderRowTotal}>{formatMoney(order.total)}</Text>
            <Text style={order.synced ? styles.syncedText : styles.pendingText}>
              {order.synced ? "متزامن" : "معلق"}
            </Text>
          </View>
          <Text style={styles.orderRowMeta}>
            {toShortDate(order.orderedAt)} -{" "}
            {order.source === "SERVER" ? "سيرفر" : "محلي"}
          </Text>
          <Text style={styles.orderRowHint}>اضغط لعرض الفاتورة</Text>
        </Pressable>
      )}
      ListHeaderComponent={
        <View style={styles.section}>
          <View style={styles.sectionHeaderInline}>
            <Text style={styles.sectionTitle}>سجل الطلبات</Text>
            <Pressable
              style={styles.smallRefreshButton}
              onPress={() =>
                void refreshActiveScreenData({
                  force: true,
                  showIndicator: false,
                })
              }
            >
              <Text style={styles.smallRefreshText}>تحديث</Text>
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.section}>
          <Text style={styles.emptyText}>لا يوجد طلبات حالياً.</Text>
        </View>
      }
    />
  );
}
