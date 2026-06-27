// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";

export function AppOverlays() {
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
    activePurchaseInvoiceDate,
    activeScreen,
    actualRemainingAmount,
    adminDatePickerTarget,
    adminDatePickerValue,
    amount,
    android,
    animationType,
    businessDate,
    carryInAmount,
    cashBoxAmount,
    cashierName,
    category,
    clientExpenseId,
    clientOrderId,
    clientPurchaseId,
    closeAdminDatePicker,
    closeMobileNav,
    closeTodayPurchasesInvoice,
    confirmAdminDatePicker,
    cover,
    date,
    datePickerConfirmButton,
    datePickerConfirmText,
    datePickerModalCard,
    description,
    differenceAmount,
    discount,
    display,
    distributedAmount,
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
    formatQuantity,
    id,
    imageUrl,
    index,
    invoiceCard,
    invoiceItemsList,
    invoiceOverlay,
    isMobileNavVisible,
    isSyncing,
    isTodayPurchasesInvoiceOpen,
    item,
    items,
    key,
    label,
    length,
    lineTotal,
    localImageUri,
    map,
    maximumDate,
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
    purchaseInvoiceBalance,
    purchaseInvoiceNoteInput,
    purchaseInvoicePaymentRows,
    purchaseInvoicePaymentsTotal,
    purchaseInvoiceProductRows,
    purchaseInvoiceRows,
    purchaseInvoiceTawasiRows,
    purchaseInvoiceTitle,
    purchaseInvoiceTotal,
    purchases,
    purchasesAmount,
    quantity,
    queue,
    refundAmount,
    resizeMode,
    rowActionButtons,
    salesAmount,
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
    sharesAmount,
    smallRefreshButton,
    smallRefreshText,
    source,
    spinner,
    status,
    statusBarTranslucent,
    statusMessage,
    storeTableTitle,
    style,
    styles,
    subtitle,
    subtotal,
    summaryRow,
    summaryText,
    summaryTextStrong,
    todayDate,
    exportPurchaseInvoicePdf,
    updatePurchaseInvoiceNoteInput,
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

  const renderPurchaseInvoiceRow = (row: any) => (
    <View key={row.key} style={styles.orderRow}>
      <View style={styles.orderRowMain}>
        <Text style={styles.orderRowId}>
          {row.purchaseKind === "TAWASI" ? "تواصي" : row.productName}
        </Text>
        <Text style={styles.orderRowItems}>
          × {formatQuantity(row.quantity)}
        </Text>
      </View>
      {row.purchaseKind === "TAWASI" ? (
        <Text style={styles.orderRowMeta}>
          رأس المال: {formatMoney(row.totalCost)} | سعر المبيع:{" "}
          {formatMoney(row.sellPrice)}
        </Text>
      ) : null}
      <View style={styles.orderRowMain}>
        <Text style={styles.orderRowMeta}>
          تكلفة الوحدة: {formatMoney(row.unitCost)}
        </Text>
        <Text style={styles.orderRowTotal}>{formatMoney(row.totalCost)}</Text>
      </View>
      <Text style={row.synced ? styles.syncedText : styles.pendingText}>
        {row.synced ? "متزامن" : `معلق (${row.pendingCount})`}
      </Text>
      {row.notes.length > 0 ? (
        <Text style={styles.orderRowMeta}>
          ملاحظة: {row.notes.join(" | ")}
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
<Modal
                  visible={isMobileNavVisible}
                  transparent
                  animationType="none"
                  statusBarTranslucent
                  onRequestClose={closeMobileNav}
                >
                  <View style={styles.mobileNavOverlayRoot}>
                    <Pressable
                      style={styles.mobileNavBackdropTap}
                      onPress={closeMobileNav}
                    >
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.mobileNavBackdrop,
                          { opacity: mobileNavBackdropOpacity },
                        ]}
                      />
                    </Pressable>
                    <Animated.View
                      style={[
                        styles.mobileNavDrawer,
                        {
                          width: mobileNavDrawerWidth,
                          transform: [{ translateX: mobileNavTranslateX }],
                        },
                      ]}
                    >
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>الصفحات</Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={closeMobileNav}
                        >
                          <Text style={styles.smallRefreshText}>إغلاق</Text>
                        </Pressable>
                      </View>
                      <ScrollView style={styles.mobileNavList}>
                        {mobileNavItems.map((item) => (
                          <Pressable
                            key={item.key}
                            style={[
                              styles.mobileNavItem,
                              activeScreen === item.key &&
                                styles.mobileNavItemActive,
                            ]}
                            onPress={() => {
                              setActiveScreen(item.key as AppScreenKey);
                              closeMobileNav();
                            }}
                          >
                            <Text
                              style={[
                                styles.mobileNavItemLabel,
                                activeScreen === item.key &&
                                  styles.mobileNavItemLabelActive,
                              ]}
                            >
                              {item.label}
                            </Text>
                            <Text
                              style={[
                                styles.mobileNavItemSubLabel,
                                activeScreen === item.key &&
                                  styles.mobileNavItemSubLabelActive,
                              ]}
                            >
                              {item.subtitle}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </Animated.View>
                  </View>
                </Modal>

                {adminDatePickerTarget && Platform.OS === "android" ? (
                  <DateTimePicker
                    mode="date"
                    value={adminDatePickerValue}
                    onChange={onAdminDatePickerChange}
                    maximumDate={new Date("2100-12-31T00:00:00")}
                    minimumDate={new Date("2000-01-01T00:00:00")}
                  />
                ) : null}
                <Modal
                  visible={
                    adminDatePickerTarget !== null && Platform.OS !== "android"
                  }
                  transparent
                  animationType="fade"
                  onRequestClose={closeAdminDatePicker}
                >
                  <View style={styles.invoiceOverlay}>
                    <View style={styles.datePickerModalCard}>
                      <Text style={styles.sectionTitle}>
                        {adminDatePickerTarget === "from"
                          ? "اختر تاريخ البداية"
                          : "اختر تاريخ النهاية"}
                      </Text>
                      {adminDatePickerTarget ? (
                        <DateTimePicker
                          mode="date"
                          display="spinner"
                          value={adminDatePickerValue}
                          onChange={onAdminDatePickerChange}
                          maximumDate={new Date("2100-12-31T00:00:00")}
                          minimumDate={new Date("2000-01-01T00:00:00")}
                        />
                      ) : null}
                      <View style={styles.rowActionButtons}>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={closeAdminDatePicker}
                        >
                          <Text style={styles.smallRefreshText}>إلغاء</Text>
                        </Pressable>
                        <Pressable
                          style={styles.datePickerConfirmButton}
                          onPress={confirmAdminDatePicker}
                        >
                          <Text style={styles.datePickerConfirmText}>
                            اعتماد التاريخ
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </Modal>

                <Modal
                  visible={selectedExpenseDetails !== null}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setSelectedExpenseDetails(null)}
                >
                  <View style={styles.invoiceOverlay}>
                    <View style={styles.invoiceCard}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>تفاصيل المصروف</Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={() => setSelectedExpenseDetails(null)}
                        >
                          <Text style={styles.smallRefreshText}>إغلاق</Text>
                        </Pressable>
                      </View>

                      {selectedExpenseDetails ? (
                        <>
                          <Text style={styles.orderRowMeta}>
                            التاريخ: {selectedExpenseDetails.expenseDate}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            التصنيف:{" "}
                            {toExpenseCategoryLabel(
                              selectedExpenseDetails.category,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            الوصف: {selectedExpenseDetails.description}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            المبلغ: {formatMoney(selectedExpenseDetails.amount)}
                          </Text>
                          {selectedExpenseDetails.note ? (
                            <Text style={styles.orderRowMeta}>
                              ملاحظة: {selectedExpenseDetails.note}
                            </Text>
                          ) : null}
                          {selectedExpenseDetails.imageUrl ||
                          selectedExpenseDetails.localImageUri ? (
                            <Image
                              source={{
                                uri:
                                  selectedExpenseDetails.imageUrl ??
                                  selectedExpenseDetails.localImageUri ??
                                  "",
                              }}
                              style={styles.expenseImageLargePreview}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={styles.emptyText}>
                              لا توجد صورة لهذا المصروف.
                            </Text>
                          )}
                        </>
                      ) : null}
                    </View>
                  </View>
                </Modal>

                <Modal
                  visible={selectedSettlementDetail !== null}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setSelectedSettlementDetail(null)}
                >
                  <View style={styles.invoiceOverlay}>
                    <View style={styles.invoiceCard}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>
                          تفاصيل تسوية اليوم
                        </Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={() => setSelectedSettlementDetail(null)}
                        >
                          <Text style={styles.smallRefreshText}>إغلاق</Text>
                        </Pressable>
                      </View>

                      {selectedSettlementDetail ? (
                        <ScrollView style={styles.invoiceItemsList}>
                          <Text style={styles.orderRowMeta}>
                            التاريخ: {selectedSettlementDetail.businessDate}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            مبيعات:{" "}
                            {formatMoney(selectedSettlementDetail.salesAmount)}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            مرتجعات:{" "}
                            {formatMoney(selectedSettlementDetail.refundAmount)}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            صافي:{" "}
                            {formatMoney(
                              selectedSettlementDetail.netSalesAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            مصاريف:{" "}
                            {formatMoney(
                              selectedSettlementDetail.expensesAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            توريدات:{" "}
                            {formatMoney(
                              selectedSettlementDetail.purchasesAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            سحوبات:{" "}
                            {formatMoney(
                              selectedSettlementDetail.withdrawalsAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            مدور:{" "}
                            {formatMoney(
                              selectedSettlementDetail.carryInAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            مفروض قبل التوزيع:{" "}
                            {formatMoney(
                              selectedSettlementDetail.expectedBeforeDistributionAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            الموزع (صندوق + حصص):{" "}
                            {formatMoney(
                              selectedSettlementDetail.distributedAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            صندوق:{" "}
                            {formatMoney(
                              selectedSettlementDetail.cashBoxAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            حصص:{" "}
                            {formatMoney(selectedSettlementDetail.sharesAmount)}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            مفروض متبقي:{" "}
                            {formatMoney(
                              selectedSettlementDetail.expectedRemainingAmount,
                            )}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            فعلي متبقي:{" "}
                            {formatMoney(
                              selectedSettlementDetail.actualRemainingAmount,
                            )}
                          </Text>
                          <Text
                            style={
                              selectedSettlementDetail.differenceAmount === 0
                                ? styles.settlementDiffNeutral
                                : selectedSettlementDetail.differenceAmount > 0
                                  ? styles.settlementDiffPositive
                                  : styles.settlementDiffNegative
                            }
                          >
                            فرق:{" "}
                            {formatMoney(
                              selectedSettlementDetail.differenceAmount,
                            )}
                          </Text>
                          {selectedSettlementDetail.note ? (
                            <Text style={styles.orderRowMeta}>
                              ملاحظة اليوم: {selectedSettlementDetail.note}
                            </Text>
                          ) : null}

                          <Text style={styles.storeTableTitle}>
                            ملخص مبيعات المنتجات (
                            {selectedSettlementDetail.productSalesSummaryRows.length})
                          </Text>
                          <View>
                            {selectedSettlementDetail.productSalesSummaryRows.length === 0 ? (
                              <Text style={styles.emptyText}>
                                لا توجد مبيعات منتجات في هذه التسوية.
                              </Text>
                            ) : (
                              selectedSettlementDetail.productSalesSummaryRows.map((row) => (
                                <View key={row.productId} style={styles.orderRow}>
                                  <View style={styles.orderRowMain}>
                                    <Text style={styles.orderRowId}>{row.name}</Text>
                                    <Text style={styles.orderRowItems}>
                                      {row.unitType === "KG" ? "كيلو" : "قطعة"}
                                    </Text>
                                  </View>
                                  <View style={styles.orderRowMain}>
                                    <Text style={styles.orderRowMeta}>
                                      مباع: {formatQuantity(row.soldQty)}
                                    </Text>
                                    <Text style={styles.orderRowMeta}>
                                      مرتجع: {formatQuantity(row.refundedQty)}
                                    </Text>
                                  </View>
                                  <View style={styles.orderRowMain}>
                                    <Text style={styles.orderRowMeta}>
                                      صافي: {formatQuantity(row.netQty)}
                                    </Text>
                                    <Text style={styles.orderRowTotal}>
                                      {formatMoney(row.netAmount)}
                                    </Text>
                                  </View>
                                </View>
                              ))
                            )}
                          </View>

                          <Text style={styles.storeTableTitle}>
                            فواتير البيع (
                            {selectedSettlementDetail.orders.length})
                          </Text>
                          <View>
                            {selectedSettlementDetail.orders.length === 0 ? (
                              <Text style={styles.emptyText}>
                                لا توجد فواتير في هذا اليوم.
                              </Text>
                            ) : (
                              selectedSettlementDetail.orders.map((order) => (
                                <Pressable
                                  key={order.clientOrderId}
                                  style={styles.orderRow}
                                  onPress={() => {
                                    setSelectedSettlementDetail(null);
                                    setSelectedOrderInvoice(order);
                                  }}
                                >
                                  <Text style={styles.orderRowId}>
                                    {order.clientOrderId}
                                  </Text>
                                  <Text style={styles.orderRowMeta}>
                                    {toOrderStatusLabel(order.status)} -{" "}
                                    {formatMoney(order.total)}
                                  </Text>
                                  <Text style={styles.orderRowMeta}>
                                    {order.cashierName} | {toPaymentMethodLabel(order.paymentMethod)} | {toShortDate(order.orderedAt)}
                                  </Text>
                                  <Text style={styles.orderRowItems}>
                                    {order.items.map((item) => `${item.productName} × ${formatQuantity(item.quantity)}`).join("، ")}
                                  </Text>
                                </Pressable>
                              ))
                            )}
                          </View>

                          <Text style={styles.storeTableTitle}>
                            المصاريف ({selectedSettlementDetail.expenses.length}
                            )
                          </Text>
                          <View>
                            {selectedSettlementDetail.expenses.length === 0 ? (
                              <Text style={styles.emptyText}>
                                لا توجد مصاريف.
                              </Text>
                            ) : (
                              selectedSettlementDetail.expenses.map(
                                (expense) => (
                                  <Pressable
                                    key={expense.clientExpenseId}
                                    style={styles.orderRow}
                                    onPress={() => {
                                      setSelectedSettlementDetail(null);
                                      setSelectedExpenseDetails(expense);
                                    }}
                                  >
                                    <Text style={styles.orderRowId}>
                                      {expense.description}
                                    </Text>
                                    <Text style={styles.orderRowMeta}>
                                      {toExpenseCategoryLabel(expense.category)} | {formatMoney(expense.amount)}
                                    </Text>
                                    {expense.note ? (
                                      <Text style={styles.orderRowMeta}>{expense.note}</Text>
                                    ) : null}
                                  </Pressable>
                                ),
                              )
                            )}
                          </View>

                          <Text style={styles.storeTableTitle}>
                            السحوبات (
                            {selectedSettlementDetail.withdrawals.length})
                          </Text>
                          <View>
                            {selectedSettlementDetail.withdrawals.length ===
                            0 ? (
                              <Text style={styles.emptyText}>
                                لا توجد سحوبات.
                              </Text>
                            ) : (
                              selectedSettlementDetail.withdrawals.map(
                                (withdrawal) => (
                                  <View
                                    key={withdrawal.id}
                                    style={styles.orderRow}
                                  >
                                    <Text style={styles.orderRowId}>
                                      {withdrawal.employeeName}
                                    </Text>
                                    <Text style={styles.orderRowMeta}>
                                      {withdrawal.withdrawalDate} | {formatMoney(withdrawal.amount)}
                                    </Text>
                                    {withdrawal.note ? (
                                      <Text style={styles.orderRowMeta}>{withdrawal.note}</Text>
                                    ) : null}
                                  </View>
                                ),
                              )
                            )}
                          </View>

                          <Text style={styles.storeTableTitle}>
                            التوريدات (
                            {selectedSettlementDetail.purchases.length})
                          </Text>
                          <View>
                            {selectedSettlementDetail.purchases.length === 0 ? (
                              <Text style={styles.emptyText}>
                                لا توجد توريدات.
                              </Text>
                            ) : (
                              selectedSettlementDetail.purchases.map(
                                (purchase) => (
                                  <View
                                    key={purchase.clientPurchaseId}
                                    style={styles.orderRow}
                                  >
                                    <Text style={styles.orderRowId}>
                                      {purchase.productName}
                                    </Text>
                                    <Text style={styles.orderRowMeta}>
                                      {purchase.purchaseKind === "PAYMENT"
                                        ? `دفعة: ${formatMoney(purchase.paymentAmount)}`
                                        : `${formatQuantity(purchase.quantity)} × ${formatMoney(purchase.unitCost)} = ${formatMoney(purchase.totalCost)}`}
                                    </Text>
                                    {purchase.purchaseKind === "TAWASI" ? (
                                      <Text style={styles.orderRowMeta}>
                                        سعر المبيع: {formatMoney(purchase.sellPrice)}
                                      </Text>
                                    ) : null}
                                    {purchase.note ? (
                                      <Text style={styles.orderRowMeta}>{purchase.note}</Text>
                                    ) : null}
                                  </View>
                                ),
                              )
                            )}
                          </View>
                        </ScrollView>
                      ) : null}
                    </View>
                  </View>
                </Modal>

                <Modal
                  visible={isTodayPurchasesInvoiceOpen}
                  transparent
                  animationType="fade"
                  onRequestClose={closeTodayPurchasesInvoice}
                >
                  <View style={styles.invoiceOverlay}>
                    <View style={styles.invoiceCard}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>
                          {purchaseInvoiceTitle}
                        </Text>
                        <View style={styles.supplyHeaderActions}>
                          <Pressable
                            style={styles.smallRefreshButton}
                            onPress={() => void exportPurchaseInvoicePdf()}
                          >
                            <Text style={styles.smallRefreshText}>PDF</Text>
                          </Pressable>
                          <Pressable
                            style={styles.smallRefreshButton}
                            onPress={closeTodayPurchasesInvoice}
                          >
                            <Text style={styles.smallRefreshText}>إغلاق</Text>
                          </Pressable>
                        </View>
                      </View>

                      <Text style={styles.orderRowMeta}>
                        الفرع: {selectedStore?.name ?? "-"}
                      </Text>
                      <Text style={styles.orderRowMeta}>
                        التاريخ: {activePurchaseInvoiceDate}
                      </Text>
                      <TextInput
                        style={styles.inputFull}
                        value={purchaseInvoiceNoteInput}
                        onChangeText={updatePurchaseInvoiceNoteInput}
                        placeholder="ملاحظة الفاتورة"
                        placeholderTextColor="#d7b3c4"
                      />

                      <Text style={styles.storeTableTitle}>المنتجات</Text>
                      <ScrollView style={styles.invoiceItemsList}>
                        {purchaseInvoiceProductRows.length === 0 ? (
                          <Text style={styles.emptyText}>
                            لا توجد منتجات موردة لهذا التاريخ.
                          </Text>
                        ) : (
                          purchaseInvoiceProductRows.map(renderPurchaseInvoiceRow)
                        )}

                        {purchaseInvoiceTawasiRows.length > 0 ? (
                          <>
                            <Text style={styles.storeTableTitle}>التواصي</Text>
                            {purchaseInvoiceTawasiRows.map(
                              renderPurchaseInvoiceRow,
                            )}
                          </>
                        ) : null}
                      </ScrollView>

                      <Text style={styles.storeTableTitle}>الدفعات</Text>
                      {purchaseInvoicePaymentRows.length === 0 ? (
                        <Text style={styles.emptyText}>لا توجد دفعات.</Text>
                      ) : (
                        purchaseInvoicePaymentRows.map((row) => (
                          <View key={row.key} style={styles.orderRow}>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>
                                {row.note || "دفعة فاتورة"}
                              </Text>
                              <Text style={styles.orderRowTotal}>
                                {formatMoney(row.amount)}
                              </Text>
                            </View>
                            <Text
                              style={row.synced ? styles.syncedText : styles.pendingText}
                            >
                              {row.synced ? "متزامن" : "معلق"}
                            </Text>
                          </View>
                        ))
                      )}

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryTextStrong}>
                          التوريدات: {formatMoney(purchaseInvoiceTotal)} | المدفوع: {formatMoney(purchaseInvoicePaymentsTotal)} | المتبقي: {formatMoney(purchaseInvoiceBalance)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Modal>

                <Modal
                  visible={selectedOrderInvoice !== null}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setSelectedOrderInvoice(null)}
                >
                  <View style={styles.invoiceOverlay}>
                    <View style={styles.invoiceCard}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>فاتورة الطلب</Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={() => setSelectedOrderInvoice(null)}
                        >
                          <Text style={styles.smallRefreshText}>إغلاق</Text>
                        </Pressable>
                      </View>

                      {selectedOrderInvoice ? (
                        <>
                          <Text style={styles.orderRowMeta}>
                            الفرع: {selectedStore?.name ?? "-"}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            رقم الفاتورة: {selectedOrderInvoice.clientOrderId}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            الكاشير: {selectedOrderInvoice.cashierName}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            التاريخ:{" "}
                            {toShortDate(selectedOrderInvoice.orderedAt)}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            الحالة:{" "}
                            {toOrderStatusLabel(selectedOrderInvoice.status)}
                          </Text>
                          <Text style={styles.orderRowMeta}>
                            الدفع:{" "}
                            {toPaymentMethodLabel(
                              selectedOrderInvoice.paymentMethod,
                            )}
                          </Text>

                          <Text style={styles.storeTableTitle}>العناصر</Text>
                          <ScrollView style={styles.invoiceItemsList}>
                            {selectedOrderInvoice.items.map((item, index) => (
                              <View
                                key={`${item.productName}-${index}`}
                                style={styles.orderRow}
                              >
                                <View style={styles.orderRowMain}>
                                  <Text style={styles.orderRowId}>
                                    {item.productName}
                                  </Text>
                                  <Text style={styles.orderRowItems}>
                                    {item.quantity}
                                  </Text>
                                </View>
                                <View style={styles.orderRowMain}>
                                  <Text style={styles.orderRowMeta}>
                                    سعر الوحدة: {formatMoney(item.unitPrice)}
                                  </Text>
                                  <Text style={styles.orderRowTotal}>
                                    {formatMoney(item.lineTotal)}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </ScrollView>

                          <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>
                              المجموع الفرعي:{" "}
                              {formatMoney(selectedOrderInvoice.subtotal)}
                            </Text>
                            <Text style={styles.summaryText}>
                              الخصم:{" "}
                              {formatMoney(selectedOrderInvoice.discount)}
                            </Text>
                            <Text style={styles.summaryText}>
                              الإجمالي:{" "}
                              {formatMoney(selectedOrderInvoice.total)}
                            </Text>
                            {selectedOrderInvoice.note ? (
                              <Text style={styles.summaryText}>
                                ملاحظة: {selectedOrderInvoice.note}
                              </Text>
                            ) : null}
                          </View>
                        </>
                      ) : null}
                    </View>
                  </View>
                </Modal>

                <View style={styles.footerStatus}>
                  <Text style={styles.footerStatusText} numberOfLines={1}>
                    {statusMessage} | عمليات بانتظار المزامنة: {queue.length}
                    {isSyncing ? " | جاري الرفع..." : ""}
                  </Text>
                </View>
    </>
  );
}
