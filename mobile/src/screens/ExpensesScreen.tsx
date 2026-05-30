// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";

export function ExpensesScreen() {
  const {
    ALL,
    CSV,
    DD,
    Image,
    MM,
    Pressable,
    Text,
    TextInput,
    View,
    YYYY,
    addExpenseCategoryOption,
    amount,
    beginExpenseEdit,
    buttonDisabled,
    canManageExpenses,
    category,
    categoryRow,
    clearExpenseImage,
    clientExpenseId,
    cover,
    d7b3c4,
    dangerButton,
    dangerButtonText,
    decimal,
    deleteExpenseRecord,
    description,
    disabled,
    effectiveExpenseCategoryOptions,
    emptyText,
    event,
    expenseAmountInput,
    expenseCategoryInput,
    expenseDate,
    expenseDateInput,
    expenseDescriptionInput,
    expenseEditingId,
    expenseFilterCategory,
    expenseFilterFrom,
    expenseFilterText,
    expenseFilterTo,
    expenseImageLocalUri,
    expenseImagePreview,
    expenseImagePreviewBox,
    expenseNoteInput,
    exportExpensesData,
    filteredExpenseRows,
    formatMoney,
    imageUrl,
    input,
    inputFull,
    inputRow,
    isAdmin,
    isPickingExpenseImage,
    item,
    key,
    keyboardType,
    label,
    length,
    localImageUri,
    map,
    newExpenseCategoryLabelInput,
    onChangeText,
    onPress,
    openExpenseDetails,
    option,
    orderRow,
    orderRowHint,
    orderRowId,
    orderRowItems,
    orderRowMain,
    orderRowMeta,
    orderRowTotal,
    pad,
    pendingText,
    pickExpenseImage,
    placeholder,
    placeholderTextColor,
    primaryButton,
    primaryButtonText,
    refreshExpensesData,
    resetExpenseForm,
    resizeMode,
    rowActionButtons,
    saveExpense,
    secondaryButton,
    secondaryButtonText,
    section,
    sectionActions,
    sectionHeaderInline,
    sectionTitle,
    selected,
    setExpenseAmountInput,
    setExpenseCategoryInput,
    setExpenseDateInput,
    setExpenseDescriptionInput,
    setExpenseFilterCategory,
    setExpenseFilterFrom,
    setExpenseFilterText,
    setExpenseFilterTo,
    setExpenseNoteInput,
    setNewExpenseCategoryLabelInput,
    smallRefreshButton,
    smallRefreshText,
    source,
    stopPropagation,
    storeChip,
    storeChipSelected,
    storeChipText,
    storeChipTextSelected,
    style,
    styles,
    synced,
    syncedText,
    toExpenseCategoryLabel,
    uri,
    value,
  } = useAppScreenContext() as any;

  return (
<>
                    <View style={styles.section}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>تسجيل المصاريف</Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={() => void refreshExpensesData()}
                        >
                          <Text style={styles.smallRefreshText}>تحديث</Text>
                        </Pressable>
                      </View>

                      {!canManageExpenses && (
                        <Text style={styles.emptyText}>
                          وضع القراءة فقط: إضافة/تعديل/حذف متاح للكاشير أو
                          الأدمن فقط.
                        </Text>
                      )}

                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.input}
                          value={expenseDateInput}
                          onChangeText={setExpenseDateInput}
                          placeholder="التاريخ YYYY-MM-DD"
                          placeholderTextColor="#d7b3c4"
                        />
                        <TextInput
                          style={styles.input}
                          value={expenseAmountInput}
                          onChangeText={setExpenseAmountInput}
                          keyboardType="decimal-pad"
                          placeholder="المبلغ"
                          placeholderTextColor="#d7b3c4"
                        />
                      </View>

                      <View style={styles.categoryRow}>
                        {effectiveExpenseCategoryOptions.map((option) => {
                          const selected =
                            expenseCategoryInput === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              style={[
                                styles.storeChip,
                                selected && styles.storeChipSelected,
                              ]}
                              onPress={() =>
                                setExpenseCategoryInput(option.value)
                              }
                            >
                              <Text
                                style={[
                                  styles.storeChipText,
                                  selected && styles.storeChipTextSelected,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {isAdmin ? (
                        <View style={styles.inputRow}>
                          <TextInput
                            style={styles.input}
                            value={newExpenseCategoryLabelInput}
                            onChangeText={setNewExpenseCategoryLabelInput}
                            placeholder="نوع مصروف جديد"
                            placeholderTextColor="#d7b3c4"
                          />
                          <Pressable
                            style={styles.smallRefreshButton}
                            onPress={addExpenseCategoryOption}
                          >
                            <Text style={styles.smallRefreshText}>
                              + إضافة النوع
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}

                      <TextInput
                        style={styles.inputFull}
                        value={expenseDescriptionInput}
                        onChangeText={setExpenseDescriptionInput}
                        placeholder="وصف المصروف"
                        placeholderTextColor="#d7b3c4"
                      />
                      <TextInput
                        style={styles.inputFull}
                        value={expenseNoteInput}
                        onChangeText={setExpenseNoteInput}
                        placeholder="ملاحظة (اختياري)"
                        placeholderTextColor="#d7b3c4"
                      />
                      <View style={styles.rowActionButtons}>
                        <Pressable
                          style={[
                            styles.smallRefreshButton,
                            isPickingExpenseImage && styles.buttonDisabled,
                          ]}
                          disabled={isPickingExpenseImage}
                          onPress={() => void pickExpenseImage()}
                        >
                          <Text style={styles.smallRefreshText}>
                            {isPickingExpenseImage
                              ? "جاري فتح الصور..."
                              : "إضافة صورة"}
                          </Text>
                        </Pressable>
                        {expenseImageLocalUri ? (
                          <Pressable
                            style={styles.dangerButton}
                            onPress={clearExpenseImage}
                          >
                            <Text style={styles.dangerButtonText}>
                              حذف الصورة
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {expenseImageLocalUri ? (
                        <View style={styles.expenseImagePreviewBox}>
                          <Image
                            source={{ uri: expenseImageLocalUri }}
                            style={styles.expenseImagePreview}
                            resizeMode="cover"
                          />
                        </View>
                      ) : null}

                      <View style={styles.sectionActions}>
                        <Pressable
                          style={[
                            styles.primaryButton,
                            !canManageExpenses && styles.buttonDisabled,
                          ]}
                          disabled={!canManageExpenses}
                          onPress={() => void saveExpense()}
                        >
                          <Text style={styles.primaryButtonText}>
                            {expenseEditingId ? "تحديث المصروف" : "إضافة مصروف"}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={resetExpenseForm}
                        >
                          <Text style={styles.secondaryButtonText}>
                            إلغاء التعديل
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.section}>
                      <View style={styles.sectionHeaderInline}>
                        <Text style={styles.sectionTitle}>سجل المصاريف</Text>
                        <Pressable
                          style={styles.smallRefreshButton}
                          onPress={() => void exportExpensesData()}
                        >
                          <Text style={styles.smallRefreshText}>تصدير CSV</Text>
                        </Pressable>
                      </View>

                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.input}
                          value={expenseFilterFrom}
                          onChangeText={setExpenseFilterFrom}
                          placeholder="من تاريخ"
                          placeholderTextColor="#d7b3c4"
                        />
                        <TextInput
                          style={styles.input}
                          value={expenseFilterTo}
                          onChangeText={setExpenseFilterTo}
                          placeholder="إلى تاريخ"
                          placeholderTextColor="#d7b3c4"
                        />
                      </View>
                      <TextInput
                        style={styles.inputFull}
                        value={expenseFilterText}
                        onChangeText={setExpenseFilterText}
                        placeholder="فلترة حسب الوصف"
                        placeholderTextColor="#d7b3c4"
                      />
                      <View style={styles.categoryRow}>
                        <Pressable
                          style={[
                            styles.storeChip,
                            expenseFilterCategory === "ALL" &&
                              styles.storeChipSelected,
                          ]}
                          onPress={() => setExpenseFilterCategory("ALL")}
                        >
                          <Text
                            style={[
                              styles.storeChipText,
                              expenseFilterCategory === "ALL" &&
                                styles.storeChipTextSelected,
                            ]}
                          >
                            الكل
                          </Text>
                        </Pressable>
                        {effectiveExpenseCategoryOptions.map((option) => {
                          const selected =
                            expenseFilterCategory === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              style={[
                                styles.storeChip,
                                selected && styles.storeChipSelected,
                              ]}
                              onPress={() =>
                                setExpenseFilterCategory(option.value)
                              }
                            >
                              <Text
                                style={[
                                  styles.storeChipText,
                                  selected && styles.storeChipTextSelected,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {filteredExpenseRows.length === 0 ? (
                        <Text style={styles.emptyText}>
                          لا يوجد قيود مصاريف.
                        </Text>
                      ) : (
                        filteredExpenseRows.map((item) => (
                          <Pressable
                            key={item.clientExpenseId}
                            style={styles.orderRow}
                            onPress={() => openExpenseDetails(item)}
                          >
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>
                                {item.description}
                              </Text>
                              <Text style={styles.orderRowItems}>
                                {toExpenseCategoryLabel(item.category)}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowTotal}>
                                {formatMoney(item.amount)}
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
                            <Text style={styles.orderRowMeta}>
                              {item.expenseDate}
                            </Text>
                            {item.imageUrl || item.localImageUri ? (
                              <Text style={styles.orderRowHint}>
                                اضغط لعرض صورة المصروف
                              </Text>
                            ) : null}
                            {canManageExpenses && (
                              <View style={styles.rowActionButtons}>
                                <Pressable
                                  style={styles.smallRefreshButton}
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    beginExpenseEdit(item);
                                  }}
                                >
                                  <Text style={styles.smallRefreshText}>
                                    تعديل
                                  </Text>
                                </Pressable>
                                <Pressable
                                  style={styles.dangerButton}
                                  onPress={(event) => {
                                    event.stopPropagation();
                                    void deleteExpenseRecord(
                                      item.clientExpenseId,
                                    );
                                  }}
                                >
                                  <Text style={styles.dangerButtonText}>
                                    حذف
                                  </Text>
                                </Pressable>
                              </View>
                            )}
                          </Pressable>
                        ))
                      )}
                    </View>
                  </>
  );
}
