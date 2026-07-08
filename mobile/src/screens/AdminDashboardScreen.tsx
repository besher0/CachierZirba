// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";

export function AdminDashboardScreen() {
  const {
    Animated,
    AppScreenKey,
    Date,
    DateTimePicker,
    Image,
    Modal,
    OS,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    activeScreen,
    adminCashboxWithdrawalAmountInput,
    adminCashboxWithdrawalNoteInput,
    adminCashboxWithdrawals,
    adminDashboardAllStoresKey,
    adminDashboardStoreId,
    adminDatePickerTarget,
    adminDatePickerValue,
    adminFromDateInput,
    adminToDateInput,
    amount,
    android,
    animationType,
    businessDate,
    carryInAmount,
    cashBoxAmount,
    cashierName,
    category,
    categoryRow,
    clearAdminDateFilters,
    clientExpenseId,
    clientOrderId,
    clientPurchaseId,
    closeAdminDatePicker,
    closeMobileNav,
    confirmAdminDatePicker,
    cover,
    dashboardRow,
    dashboardStoreName,
    dashboardSummaries,
    date,
    datePickerConfirmButton,
    datePickerConfirmText,
    datePickerInputPlaceholder,
    datePickerInputText,
    datePickerModalCard,
    description,
    differenceAmount,
    discount,
    display,
    distributedAmount,
    effectiveDashboardTotals,
    employeeName,
    emptyText,
    expectedBeforeDistributionAmount,
    expectedRemainingAmount,
    expense,
    expenseDate,
    expenseImageLargePreview,
    expenses,
    expensesAmount,
    fade,
    footerStatus,
    footerStatusText,
    formatMoney,
    id,
    imageUrl,
    index,
    input,
    inputRow,
    invoiceCard,
    invoiceItemsList,
    invoiceOverlay,
    isAdmin,
    isMobileNavVisible,
    isSyncing,
    item,
    items,
    key,
    label,
    length,
    lineTotal,
    localImageUri,
    map,
    maximumDate,
    metricCard,
    metricLabel,
    metricValue,
    metricsGrid,
    minimumDate,
    mobileNavBackdrop,
    mobileNavBackdropOpacity,
    mobileNavBackdropTap,
    mobileNavDrawer,
    mobileNavDrawerWidth,
    mobileNavItem,
    mobileNavItemActive,
    mobileNavItemLabel,
    mobileNavItemLabelActive,
    mobileNavItemSubLabel,
    mobileNavItemSubLabelActive,
    mobileNavItems,
    mobileNavList,
    mobileNavOverlayRoot,
    mobileNavTranslateX,
    mode,
    name,
    netSalesAmount,
    none,
    note,
    numberOfLines,
    onAdminDatePickerChange,
    onChange,
    onPress,
    onRequestClose,
    opacity,
    openAdminDatePicker,
    order,
    orderRow,
    orderRowId,
    orderRowItems,
    orderRowMain,
    orderRowMeta,
    orderRowTotal,
    orderedAt,
    orders,
    paymentMethod,
    pointerEvents,
    productName,
    purchase,
    purchases,
    purchasesAmount,
    quantity,
    queue,
    refreshDashboardData,
    refundAmount,
    resizeMode,
    rowActionButtons,
    salesAmount,
    section,
    sectionHeaderInline,
    sectionTitle,
    selectedAdminCashboxRemainingAmount,
    selectedExpenseDetails,
    selectedOrderInvoice,
    selectedSettlementDetail,
    selectedStore,
    setAdminCashboxWithdrawalNoteInput,
    setAdminDashboardStoreId,
    setActiveScreen,
    setSelectedExpenseDetails,
    setSelectedOrderInvoice,
    setSelectedSettlementDetail,
    sharesAmount,
    smallRefreshButton,
    smallRefreshText,
    source,
    spinner,
    status,
    statusBarTranslucent,
    statusMessage,
    storeChip,
    storeChipSelected,
    storeChipText,
    storeChipTextSelected,
    storeId,
    storeName,
    storeTableTitle,
    stores,
    style,
    styles,
    subtitle,
    subtotal,
    submitAdminCashboxWithdrawal,
    summary,
    summaryRow,
    summaryText,
    to,
    toExpenseCategoryLabel,
    toOrderStatusLabel,
    toPaymentMethodLabel,
    toShortDate,
    total,
    updateAdminCashboxWithdrawalAmountInput,
    totalCost,
    transform,
    translateX,
    transparent,
    unitPrice,
    uri,
    value,
    visible,
    width,
    withdrawal,
    withdrawals,
    withdrawalsAmount,
  } = useAppScreenContext() as any;

  return (
<View style={styles.section}>
                    {!isAdmin ? (
                      <Text style={styles.emptyText}>
                        هذه الصفحة متاحة للإدارة فقط.
                      </Text>
                    ) : (
                      <>
                        <View style={styles.sectionHeaderInline}>
                          <Text style={styles.sectionTitle}>
                            لوحة تسوية الفروع
                          </Text>
                          <Pressable
                            style={styles.smallRefreshButton}
                            onPress={() => void refreshDashboardData()}
                          >
                            <Text style={styles.smallRefreshText}>تحديث</Text>
                          </Pressable>
                        </View>

                        <Text style={styles.orderRowMeta}>
                          اختر الفرع والمدة لعرض إجمالي الحصص والصندوق.
                        </Text>
                        <View style={styles.categoryRow}>
                          <Pressable
                            style={[
                              styles.storeChip,
                              adminDashboardStoreId === adminDashboardAllStoresKey &&
                                styles.storeChipSelected,
                            ]}
                            onPress={() =>
                              setAdminDashboardStoreId(adminDashboardAllStoresKey)
                            }
                          >
                            <Text
                              style={[
                                styles.storeChipText,
                                adminDashboardStoreId === adminDashboardAllStoresKey &&
                                  styles.storeChipTextSelected,
                              ]}
                            >
                              كل الفروع
                            </Text>
                          </Pressable>
                          {stores.map((store) => {
                            const selected = adminDashboardStoreId === store.id;
                            return (
                              <Pressable
                                key={store.id}
                                style={[
                                  styles.storeChip,
                                  selected && styles.storeChipSelected,
                                ]}
                                onPress={() => setAdminDashboardStoreId(store.id)}
                              >
                                <Text
                                  style={[
                                    styles.storeChipText,
                                    selected && styles.storeChipTextSelected,
                                  ]}
                                >
                                  {store.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        <View style={styles.inputRow}>
                          <Pressable
                            style={styles.input}
                            onPress={() => openAdminDatePicker("from")}
                          >
                            <Text
                              style={
                                adminFromDateInput
                                  ? styles.datePickerInputText
                                  : styles.datePickerInputPlaceholder
                              }
                            >
                              {adminFromDateInput || "اختر من تاريخ"}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={styles.input}
                            onPress={() => openAdminDatePicker("to")}
                          >
                            <Text
                              style={
                                adminToDateInput
                                  ? styles.datePickerInputText
                                  : styles.datePickerInputPlaceholder
                              }
                            >
                              {adminToDateInput || "اختر إلى تاريخ"}
                            </Text>
                          </Pressable>
                        </View>
                        <View style={styles.rowActionButtons}>
                          <Pressable
                            style={styles.smallRefreshButton}
                            onPress={clearAdminDateFilters}
                          >
                            <Text style={styles.smallRefreshText}>
                              مسح التاريخ
                            </Text>
                          </Pressable>
                        </View>
                        <Text style={styles.orderRowMeta}>
                          التقرير يحسب إجمالي الحصص والصندوق ضمن الفترة
                          المحددة.
                        </Text>

                        <View style={styles.metricsGrid}>
                          <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>إجمالي الحصص</Text>
                            <Text style={styles.metricValue}>
                              {formatMoney(
                                effectiveDashboardTotals.sharesAmount,
                              )}
                            </Text>
                          </View>
                          <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>
                              إجمالي الصندوق
                            </Text>
                            <Text style={styles.metricValue}>
                              {formatMoney(
                                effectiveDashboardTotals.cashBoxAmount,
                              )}
                            </Text>
                          </View>
                          <View style={styles.metricCard}>
                            <Text style={styles.metricLabel}>سحوبات الصندوق</Text>
                            <Text style={styles.metricValue}>
                              {formatMoney(
                                effectiveDashboardTotals.cashBoxWithdrawalsAmount ?? 0,
                              )}
                            </Text>
                          </View>
                          <View style={styles.metricCardHighlight}>
                            <Text style={styles.metricLabelHighlight}>
                              المتبقي الفعلي الحالي
                            </Text>
                            <Text style={styles.metricValueHighlight}>
                              {formatMoney(
                                effectiveDashboardTotals.actualCashBoxRemainingAmount ?? 0,
                              )}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.storeTableTitle}>سحب من الصندوق</Text>
                        <Text style={styles.orderRowMeta}>
                          السحب سيتم من الصندوق العام لكل الفروع. المتبقي الحالي: {formatMoney(selectedAdminCashboxRemainingAmount)}
                        </Text>
                        <View style={styles.inputRow}>
                          <TextInput
                            style={styles.input}
                            value={adminCashboxWithdrawalAmountInput}
                            onChangeText={updateAdminCashboxWithdrawalAmountInput}
                            keyboardType="decimal-pad"
                            placeholder="مبلغ السحب"
                            placeholderTextColor="#d7b3c4"
                          />
                        </View>
                        <TextInput
                          style={styles.inputFull}
                          value={adminCashboxWithdrawalNoteInput}
                          onChangeText={setAdminCashboxWithdrawalNoteInput}
                          placeholder="ملاحظة السحب اختيارية"
                          placeholderTextColor="#d7b3c4"
                        />
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => void submitAdminCashboxWithdrawal()}
                        >
                          <Text style={styles.secondaryButtonText}>
                            تسجيل السحب
                          </Text>
                        </Pressable>

                        <Text style={styles.storeTableTitle}>سحوبات الصندوق</Text>
                        {adminCashboxWithdrawals.length === 0 ? (
                          <Text style={styles.emptyText}>
                            لا توجد سحوبات صندوق ضمن الفترة المحددة.
                          </Text>
                        ) : (
                          adminCashboxWithdrawals.map((withdrawal) => (
                            <View
                              key={withdrawal.id}
                              style={styles.dashboardRow}
                            >
                              <View style={styles.orderRowMain}>
                                <Text style={styles.dashboardStoreName}>
                                  {formatMoney(withdrawal.amount)}
                                </Text>
                                <Text style={styles.orderRowMeta}>
                                  {toShortDate(withdrawal.withdrawnAt)}
                                </Text>
                              </View>
                              <Text style={styles.orderRowMeta}>
                                سجله: {withdrawal.createdByDisplayName || "-"}
                              </Text>
                              {withdrawal.note ? (
                                <Text style={styles.orderRowMeta}>
                                  {withdrawal.note}
                                </Text>
                              ) : null}
                            </View>
                          ))
                        )}

                        <Text style={styles.storeTableTitle}>
                          {adminDashboardStoreId === adminDashboardAllStoresKey
                            ? "ملخص كل الفروع"
                            : "ملخص الفرع المختار"}
                        </Text>
                        {dashboardSummaries.length === 0 ? (
                          <Text style={styles.emptyText}>
                            لا توجد بيانات من السيرفر بعد.
                          </Text>
                        ) : (
                          dashboardSummaries.map((summary) => (
                            <View
                              key={summary.storeId}
                              style={styles.dashboardRow}
                            >
                              <View style={styles.orderRowMain}>
                                <Text style={styles.dashboardStoreName}>
                                  {summary.storeName}
                                </Text>
                              </View>
                              <View style={styles.orderRowMain}>
                                <Text style={styles.orderRowMeta}>
                                  حصص: {formatMoney(summary.sharesAmount)}
                                </Text>
                                <Text style={styles.orderRowMeta}>
                                  صندوق: {formatMoney(summary.cashBoxAmount)}
                                </Text>
                              </View>
                              <View style={styles.orderRowMain}>
                                <Text style={styles.orderRowMeta}>
                                  سحوبات: غير منسوبة للفرع
                                </Text>
                                <Text style={styles.orderRowMeta}>
                                  متبقي فعلي: {formatMoney(summary.actualCashBoxRemainingAmount ?? 0)}
                                </Text>
                              </View>
                            </View>
                          ))
                        )}
                      </>
                    )}
                  </View>
  );
}
