// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";

export function SettlementScreen() {
  const {
    KG,
    Pressable,
    Text,
    TextInput,
    View,
    actualRemainingAmount,
    actualRemainingInput,
    adjustmentAmount,
    auditNetSalesAmount,
    businessDate,
    cashBoxAmount,
    cashBoxInput,
    commitInventoryAdjustment,
    d7b3c4,
    decimal,
    diffQty,
    differenceAmount,
    emptyText,
    expectedQty,
    formatMoney,
    input,
    inputFull,
    inputRow,
    isAdmin,
    item,
    key,
    keyboardType,
    length,
    map,
    mergedSettlementRows,
    name,
    netAmount,
    netQty,
    onChangeText,
    onPress,
    openSettlementDetails,
    orderRow,
    orderRowHint,
    orderRowId,
    orderRowItems,
    orderRowMain,
    orderRowMeta,
    orderRowTotal,
    pad,
    pendingText,
    pieceStockAuditRows,
    placeholder,
    placeholderTextColor,
    productId,
    productName,
    productSalesSummaryRows,
    refreshSettlementData,
    refundedQty,
    row,
    secondaryButton,
    secondaryButtonText,
    section,
    sectionHeaderInline,
    sectionTitle,
    setActualRemainingInput,
    setSettlementNoteInput,
    settlementActualInputs,
    settlementCarryForwardAmount,
    settlementCycleStartIso,
    settlementDiffNegative,
    settlementDiffNeutral,
    settlementDiffPositive,
    settlementDifferenceAmount,
    settlementExpectedRevenueAmount,
    settlementNetSalesWithAudit,
    settlementNoteInput,
    settlementOverDistributedAmount,
    settlementProductSalesSummaryRows,
    settlementRefundTotalWithAudit,
    settlementRow,
    settlementSalesTotalWithAudit,
    settlementStatCard,
    settlementStatCardHighlight,
    settlementStatLabel,
    settlementStatLabelHighlight,
    settlementStatValue,
    settlementStatValueHighlight,
    settlementStatsGrid,
    sharesAmount,
    sharesInput,
    smallRefreshButton,
    smallRefreshText,
    soldQty,
    storeTableTitle,
    style,
    styles,
    submitDailySettlement,
    summaryRow,
    summaryText,
    synced,
    syncedText,
    toShortDate,
    todayEmployeeWithdrawalsTotal,
    todayExpectedRemaining,
    todayExpensesTotal,
    todayNetSales,
    todayPurchasesTotal,
    todayRefundTotal,
    todaySalesTotal,
    unitType,
    updateCashBoxInput,
    updateSettlementActualInput,
    updateSharesInput,
    value,
  } = useAppScreenContext() as any;

  return (
<>
                    <View style={styles.section}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>تسوية اليوم</Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={() => void refreshSettlementData()}
                        >
                          <Text style={styles.smallRefreshText}>
                            تحديث الكل
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.settlementStatsGrid}>
                        <View style={styles.settlementStatCard}>
                          <Text style={styles.settlementStatLabel}>
                            مبيعات الدورة
                          </Text>
                          <Text style={styles.settlementStatValue}>
                            {formatMoney(settlementSalesTotalWithAudit)}
                          </Text>
                        </View>
                        <View style={styles.settlementStatCard}>
                          <Text style={styles.settlementStatLabel}>
                            مرتجعات الدورة
                          </Text>
                          <Text style={styles.settlementStatValue}>
                            {formatMoney(settlementRefundTotalWithAudit)}
                          </Text>
                        </View>
                        <View style={styles.settlementStatCard}>
                          <Text style={styles.settlementStatLabel}>
                            صافي الدورة
                          </Text>
                          <Text style={styles.settlementStatValue}>
                            {formatMoney(settlementNetSalesWithAudit)}
                          </Text>
                        </View>
                        <View style={styles.settlementStatCard}>
                          <Text style={styles.settlementStatLabel}>
                            توريدات الدورة
                          </Text>
                          <Text style={styles.settlementStatValue}>
                            {formatMoney(todayPurchasesTotal)}
                          </Text>
                        </View>
                        <View style={styles.settlementStatCard}>
                          <Text style={styles.settlementStatLabel}>
                            مصاريف الدورة
                          </Text>
                          <Text style={styles.settlementStatValue}>
                            {formatMoney(todayExpensesTotal)}
                          </Text>
                        </View>
                        <View style={styles.settlementStatCard}>
                          <Text style={styles.settlementStatLabel}>
                            سحوبات الدورة
                          </Text>
                          <Text style={styles.settlementStatValue}>
                            {formatMoney(todayEmployeeWithdrawalsTotal)}
                          </Text>
                        </View>
                        <View style={styles.settlementStatCardHighlight}>
                          <Text style={styles.settlementStatLabelHighlight}>
                            المبلغ المفروض متبقي
                          </Text>
                          <Text style={styles.settlementStatValueHighlight}>
                            {formatMoney(settlementExpectedRevenueAmount)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.orderRowMeta}>
                        المعادلة: (المبيعات - المرتجعات) - المصاريف - التوريدات
                        - سحوبات الموظفين + الكاش المدوّر (بالموجب)
                      </Text>
                      {settlementCycleStartIso ? (
                        <Text style={styles.orderRowMeta}>
                          الدورة الحالية محسوبة من بعد آخر تسوية:{" "}
                          {toShortDate(settlementCycleStartIso)}
                        </Text>
                      ) : null}

                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.input}
                          value={cashBoxInput}
                          onChangeText={updateCashBoxInput}
                          keyboardType="decimal-pad"
                          placeholder="قيمة الصندوق"
                          placeholderTextColor="#d7b3c4"
                        />
                        <TextInput
                          style={styles.input}
                          value={sharesInput}
                          onChangeText={updateSharesInput}
                          keyboardType="decimal-pad"
                          placeholder="قيمة الحصص"
                          placeholderTextColor="#d7b3c4"
                        />
                      </View>
                      <TextInput
                        style={styles.inputFull}
                        value={actualRemainingInput}
                        onChangeText={setActualRemainingInput}
                        keyboardType="decimal-pad"
                        placeholder="المبلغ المتبقي الفعلي مع الكاشير"
                        placeholderTextColor="#d7b3c4"
                      />
                      <Text style={styles.orderRowMeta}>
                        صافي فرق جرد القطع على المبيعات:{" "}
                        {formatMoney(auditNetSalesAmount)}
                      </Text>
                      <Text style={styles.orderRowMeta}>
                        المفروض قبل التوزيع بعد الجرد:{" "}
                        {formatMoney(settlementExpectedRevenueAmount)}
                      </Text>
                      <Text style={styles.orderRowMeta}>
                        المتبقي الذي سيُرحّل تلقائياً للمدوّر:{" "}
                        {formatMoney(settlementCarryForwardAmount)}
                      </Text>
                      <Text
                        style={
                          settlementDifferenceAmount === 0
                            ? styles.settlementDiffNeutral
                            : settlementDifferenceAmount > 0
                              ? styles.settlementDiffPositive
                              : styles.settlementDiffNegative
                        }
                      >
                        فرق التسوية (الفعلي مع الكاشير - المفروض قبل التوزيع):{" "}
                        {formatMoney(settlementDifferenceAmount)}
                      </Text>
                      {settlementOverDistributedAmount > 0 ? (
                        <Text style={styles.pendingText}>
                          تنبيه: المدخلات (صندوق + حصص) أعلى من المبلغ الفعلي مع الكاشير بمقدار{" "}
                          {formatMoney(settlementOverDistributedAmount)}.
                        </Text>
                      ) : null}
                      <TextInput
                        style={styles.inputFull}
                        value={settlementNoteInput}
                        onChangeText={setSettlementNoteInput}
                        placeholder="ملاحظة اليوم (اختياري)"
                        placeholderTextColor="#d7b3c4"
                      />

                      <Text style={styles.storeTableTitle}>
                        ملخص بيع المنتجات للدورة الحالية
                      </Text>
                      {settlementProductSalesSummaryRows.length === 0 ? (
                        <Text style={styles.emptyText}>
                          لا يوجد حركات بيع/إرجاع ضمن الدورة الحالية.
                        </Text>
                      ) : (
                        settlementProductSalesSummaryRows.map((row) => (
                          <View key={row.productId} style={styles.orderRow}>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>{row.name}</Text>
                              <Text style={styles.orderRowItems}>
                                {row.unitType === "KG" ? "كيلو" : "قطعة"}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                مباع: {row.soldQty}
                              </Text>
                              <Text style={styles.orderRowMeta}>
                                مرتجع: {row.refundedQty}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                صافي كمية: {row.netQty}
                              </Text>
                              <Text style={styles.orderRowTotal}>
                                {formatMoney(row.netAmount)}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}

                      <Text style={styles.storeTableTitle}>
                        تدقيق مخزون منتجات القطعة
                      </Text>
                      {isAdmin ? (
                        <Text style={styles.orderRowMeta}>
                          أدخل الرصيد الفعلي، ثم غادر الخانة لاعتماده كمخزون
                          جديد. لا يُسجل كتوريد ولا يدخل في الحساب المالي
                          للتسوية.
                        </Text>
                      ) : null}
                      {pieceStockAuditRows.length === 0 ? (
                        <Text style={styles.emptyText}>
                          لا يوجد منتجات قطعة للتدقيق.
                        </Text>
                      ) : (
                        pieceStockAuditRows.map((row) => (
                          <View key={row.productId} style={styles.orderRow}>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>
                                {row.productName}
                              </Text>
                              <Text style={styles.orderRowItems}>
                                المتبقي النظري: {row.expectedQty}
                              </Text>
                            </View>
                            <TextInput
                              style={styles.inputFull}
                              value={
                                settlementActualInputs[row.productId] ?? ""
                              }
                              onChangeText={(value) =>
                                updateSettlementActualInput(
                                  row.productId,
                                  value,
                                )
                              }
                              onBlur={() => {
                                if (isAdmin) {
                                  void commitInventoryAdjustment(row.productId);
                                }
                              }}
                              keyboardType="decimal-pad"
                              placeholder="أدخل العدد الفعلي (قطعة)"
                              placeholderTextColor="#d7b3c4"
                            />
                            {row.diffQty !== null ? (
                              <Text
                                style={
                                  row.diffQty === 0
                                    ? styles.settlementDiffNeutral
                                    : row.diffQty > 0
                                      ? styles.settlementDiffPositive
                                      : styles.settlementDiffNegative
                                }
                              >
                                الفرق: {row.diffQty}
                              </Text>
                            ) : null}
                            {!isAdmin && row.adjustmentAmount !== null ? (
                              <Text style={styles.orderRowMeta}>
                                قيمة الفرق المحتسبة على المبيعات:{" "}
                                {formatMoney(row.adjustmentAmount)}
                              </Text>
                            ) : null}
                          </View>
                        ))
                      )}

                      <View style={styles.summaryRow}>
                        {isAdmin ? (
                          <Text style={styles.summaryText}>
                            ضبط الأدمن يغيّر المخزون فقط، ولا ينشئ حركة بيع أو
                            إرجاع ولا يغيّر التوريدات أو نتيجة التسوية.
                          </Text>
                        ) : (
                          <Text style={styles.summaryText}>
                            ملاحظة: الفرق الموجب يولد إرجاع تلقائي، والفرق
                            السالب يولد بيع تلقائي وتُضاف قيمته للمبيعات بعد
                            التحصيل.
                          </Text>
                        )}
                      </View>

                      <Pressable
                        style={styles.secondaryButton}
                        onPress={() => void submitDailySettlement()}
                      >
                        <Text style={styles.secondaryButtonText}>
                          إغلاق اليوم وحفظ التسوية
                        </Text>
                      </Pressable>
                    </View>

                    <View style={styles.section}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>أرشيف التسويات</Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={() => void refreshSettlementData()}
                        >
                          <Text style={styles.smallRefreshText}>تحديث</Text>
                        </Pressable>
                      </View>

                      {mergedSettlementRows.length === 0 ? (
                        <Text style={styles.emptyText}>
                          لا يوجد تسويات مسجلة بعد.
                        </Text>
                      ) : (
                        mergedSettlementRows.map((item) => (
                          <Pressable
                            key={item.businessDate}
                            style={styles.settlementRow}
                            onPress={() => openSettlementDetails(item)}
                          >
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>
                                {item.businessDate}
                              </Text>
                              <Text
                                style={
                                  item.synced
                                    ? styles.syncedText
                                    : styles.pendingText
                                }
                              >
                                {item.synced ? "متزامن" : "معلق"}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                صندوق: {formatMoney(item.cashBoxAmount)}
                              </Text>
                              <Text style={styles.orderRowMeta}>
                                حصص: {formatMoney(item.sharesAmount)}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                متبقي فعلي:{" "}
                                {formatMoney(item.actualRemainingAmount)}
                              </Text>
                              <Text
                                style={
                                  item.differenceAmount === 0
                                    ? styles.settlementDiffNeutral
                                    : item.differenceAmount > 0
                                      ? styles.settlementDiffPositive
                                      : styles.settlementDiffNegative
                                }
                              >
                                فرق: {formatMoney(item.differenceAmount)}
                              </Text>
                            </View>
                            <Text style={styles.orderRowHint}>
                              اضغط لعرض تفاصيل التسوية
                            </Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  </>
  );
}
