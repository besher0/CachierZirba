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
    View,
    activeScreen,
    actualRemainingAmount,
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
    expectedCarryForwardAmount,
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
    metricCardHighlight,
    metricLabel,
    metricLabelHighlight,
    metricValue,
    metricValueHighlight,
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
    selectedExpenseDetails,
    selectedOrderInvoice,
    selectedSettlementDetail,
    selectedStore,
    setActiveScreen,
    setSelectedExpenseDetails,
    setSelectedOrderInvoice,
    setSelectedSettlementDetail,
    settlementDiffNegative,
    settlementDiffNeutral,
    settlementDiffPositive,
    settlementDifferenceAmount,
    sharesAmount,
    smallRefreshButton,
    smallRefreshText,
    source,
    spinner,
    status,
    statusBarTranslucent,
    statusMessage,
    storeId,
    storeName,
    storeTableTitle,
    style,
    styles,
    subtitle,
    subtotal,
    summary,
    summaryRow,
    summaryText,
    to,
    toExpenseCategoryLabel,
    toOrderStatusLabel,
    toPaymentMethodLabel,
    toShortDate,
    total,
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
                          التقرير يحسب الحصص/الصندوق/المدوّر المرحّل والفرق بين
                          الفعلي والمفروض قبل التوزيع ضمن الفترة المحددة.
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
                            <Text style={styles.metricLabel}>
                              المدوّر المرحّل
                            </Text>
                            <Text style={styles.metricValue}>
                              {formatMoney(
                                effectiveDashboardTotals.expectedCarryForwardAmount,
                              )}
                            </Text>
                          </View>
                          <View style={styles.metricCardHighlight}>
                            <Text style={styles.metricLabelHighlight}>
                              فرق التسوية
                            </Text>
                            <Text style={styles.metricValueHighlight}>
                              {formatMoney(
                                effectiveDashboardTotals.settlementDifferenceAmount,
                              )}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.storeTableTitle}>
                          ملخص كل المحلات
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
                                <Text
                                  style={
                                    summary.settlementDifferenceAmount === 0
                                      ? styles.settlementDiffNeutral
                                      : summary.settlementDifferenceAmount > 0
                                        ? styles.settlementDiffPositive
                                        : styles.settlementDiffNegative
                                  }
                                >
                                  فرق:{" "}
                                  {formatMoney(
                                    summary.settlementDifferenceAmount,
                                  )}
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
                                  مدوّر مرحّل:{" "}
                                  {formatMoney(
                                    summary.expectedCarryForwardAmount,
                                  )}
                                </Text>
                                <Text style={styles.orderRowMeta}>
                                  متبقي فعلي:{" "}
                                  {formatMoney(summary.actualRemainingAmount)}
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
