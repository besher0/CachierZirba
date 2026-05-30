// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";

export function OrdersScreen() {
  const {
    Pressable,
    SERVER,
    Text,
    View,
    clientOrderId,
    emptyText,
    formatMoney,
    itemsCount,
    key,
    length,
    map,
    mergedOrderRows,
    onPress,
    order,
    orderRow,
    orderRowHint,
    orderRowId,
    orderRowItems,
    orderRowMain,
    orderRowMeta,
    orderRowTotal,
    orderedAt,
    pendingText,
    refreshOrdersData,
    section,
    sectionHeaderInline,
    sectionTitle,
    setSelectedOrderInvoice,
    smallRefreshButton,
    smallRefreshText,
    source,
    status,
    style,
    styles,
    synced,
    syncedText,
    toOrderStatusLabel,
    toShortDate,
    total,
  } = useAppScreenContext() as any;

  return (
<View style={styles.section}>
                    <View style={styles.sectionHeaderInline}>
                      <Text style={styles.sectionTitle}>سجل الطلبات</Text>
                      <Pressable
                        style={styles.smallRefreshButton}
                        onPress={() => void refreshOrdersData()}
                      >
                        <Text style={styles.smallRefreshText}>تحديث</Text>
                      </Pressable>
                    </View>

                    {mergedOrderRows.length === 0 ? (
                      <Text style={styles.emptyText}>
                        لا يوجد طلبات حالياً.
                      </Text>
                    ) : (
                      mergedOrderRows.map((order) => (
                        <Pressable
                          key={order.clientOrderId}
                          style={styles.orderRow}
                          onPress={() => setSelectedOrderInvoice(order)}
                        >
                          <View style={styles.orderRowMain}>
                            <Text style={styles.orderRowId}>
                              {order.clientOrderId}
                            </Text>
                            <Text style={styles.orderRowItems}>
                              {toOrderStatusLabel(order.status)} -{" "}
                              {order.itemsCount} عناصر
                            </Text>
                          </View>
                          <View style={styles.orderRowMain}>
                            <Text style={styles.orderRowTotal}>
                              {formatMoney(order.total)}
                            </Text>
                            <Text
                              style={
                                order.synced
                                  ? styles.syncedText
                                  : styles.pendingText
                              }
                            >
                              {order.synced ? "متزامن" : "معلق"}
                            </Text>
                          </View>
                          <Text style={styles.orderRowMeta}>
                            {toShortDate(order.orderedAt)} -{" "}
                            {order.source === "SERVER" ? "سيرفر" : "محلي"}
                          </Text>
                          <Text style={styles.orderRowHint}>
                            اضغط لعرض الفاتورة
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>
  );
}
