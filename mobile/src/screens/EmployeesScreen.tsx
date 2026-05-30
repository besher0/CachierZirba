// @ts-nocheck
import { useAppScreenContext } from "./AppScreenContext";

export function EmployeesScreen() {
  const {
    DD,
    MM,
    Pressable,
    Text,
    TextInput,
    View,
    YYYY,
    absenceDate,
    absenceDateInput,
    absenceDays,
    absenceEmployeeIdInput,
    absenceNoteInput,
    addEmployeeAbsence,
    addEmployeeDefinition,
    addEmployeeWithdrawal,
    amount,
    attendanceDays,
    balance,
    buttonDisabled,
    canManageInventory,
    categoryRow,
    d7b3c4,
    dangerButton,
    dangerButtonText,
    decimal,
    disabled,
    earnedAmount,
    employee,
    employeeId,
    employeeName,
    employeeNameInput,
    employeeSummaryRow,
    employeeWeeklySalaryInput,
    employeeWeeklySnapshots,
    emptyText,
    entry,
    find,
    formatMoney,
    id,
    input,
    inputFull,
    inputRow,
    item,
    key,
    keyboardType,
    length,
    map,
    name,
    note,
    onChangeText,
    onPress,
    orderRow,
    orderRowId,
    orderRowItems,
    orderRowMain,
    orderRowMeta,
    orderRowTotal,
    pad,
    pendingText,
    placeholder,
    placeholderTextColor,
    primaryButton,
    primaryButtonText,
    recentAbsenceRows,
    recentWithdrawalRows,
    removeEmployeeAbsence,
    removeEmployeeWithdrawal,
    rowActionButtons,
    section,
    sectionActions,
    sectionTitle,
    selected,
    selectedStoreEmployees,
    setAbsenceDateInput,
    setAbsenceEmployeeIdInput,
    setAbsenceNoteInput,
    setEmployeeNameInput,
    setEmployeeWeeklySalaryInput,
    setWithdrawalAmountInput,
    setWithdrawalDateInput,
    setWithdrawalEmployeeIdInput,
    setWithdrawalNoteInput,
    storeChip,
    storeChipSelected,
    storeChipText,
    storeChipTextSelected,
    style,
    styles,
    syncedText,
    value,
    weekEndDate,
    weekStartDate,
    weeklySalary,
    withdrawalAmountInput,
    withdrawalDate,
    withdrawalDateInput,
    withdrawalEmployeeIdInput,
    withdrawalNoteInput,
  } = useAppScreenContext() as any;

  return (
<>
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>إدارة الموظفين</Text>
                      {!canManageInventory && (
                        <Text style={styles.emptyText}>
                          وضع القراءة فقط: إدارة الموظفين متاحة للكاشير أو
                          الأدمن فقط.
                        </Text>
                      )}
                      <Text style={styles.orderRowMeta}>
                        أسبوع الحساب: {weekStartDate} إلى {weekEndDate} (الموظف
                        مداوم افتراضياً إلا إذا سجلت غياب)
                      </Text>
                      <View style={styles.inputRow}>
                        <TextInput
                          style={styles.input}
                          value={employeeWeeklySalaryInput}
                          onChangeText={setEmployeeWeeklySalaryInput}
                          keyboardType="decimal-pad"
                          placeholder="الراتب الأسبوعي"
                          placeholderTextColor="#d7b3c4"
                        />
                        <TextInput
                          style={styles.input}
                          value={employeeNameInput}
                          onChangeText={setEmployeeNameInput}
                          placeholder="اسم الموظف"
                          placeholderTextColor="#d7b3c4"
                        />
                      </View>
                      <Pressable
                        style={[
                          styles.primaryButton,
                          !canManageInventory && styles.buttonDisabled,
                        ]}
                        disabled={!canManageInventory}
                        onPress={addEmployeeDefinition}
                      >
                        <Text style={styles.primaryButtonText}>
                          + إضافة موظف
                        </Text>
                      </Pressable>

                      {employeeWeeklySnapshots.length === 0 ? (
                        <Text style={styles.emptyText}>
                          لا يوجد موظفون في هذا الفرع بعد.
                        </Text>
                      ) : (
                        employeeWeeklySnapshots.map((item) => (
                          <View
                            key={item.employeeId}
                            style={styles.employeeSummaryRow}
                          >
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowId}>
                                {item.employeeName}
                              </Text>
                              <Text style={styles.orderRowItems}>
                                راتب أسبوعي: {formatMoney(item.weeklySalary)}
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                غياب: {item.absenceDays} يوم
                              </Text>
                              <Text style={styles.orderRowMeta}>
                                دوام: {item.attendanceDays} يوم
                              </Text>
                            </View>
                            <View style={styles.orderRowMain}>
                              <Text style={styles.orderRowMeta}>
                                مستحق: {formatMoney(item.earnedAmount)}
                              </Text>
                              <Text
                                style={
                                  item.balance >= 0
                                    ? styles.syncedText
                                    : styles.pendingText
                                }
                              >
                                الرصيد: {formatMoney(item.balance)}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>تسجيل غياب</Text>
                      {selectedStoreEmployees.length === 0 ? (
                        <Text style={styles.emptyText}>
                          أضف موظف أولاً لتسجيل الغياب.
                        </Text>
                      ) : (
                        <>
                          <View style={styles.categoryRow}>
                            {selectedStoreEmployees.map((employee) => {
                              const selected =
                                absenceEmployeeIdInput === employee.id;
                              return (
                                <Pressable
                                  key={employee.id}
                                  style={[
                                    styles.storeChip,
                                    selected && styles.storeChipSelected,
                                  ]}
                                  onPress={() =>
                                    setAbsenceEmployeeIdInput(employee.id)
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.storeChipText,
                                      selected && styles.storeChipTextSelected,
                                    ]}
                                  >
                                    {employee.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <TextInput
                            style={styles.inputFull}
                            value={absenceDateInput}
                            onChangeText={setAbsenceDateInput}
                            placeholder="تاريخ الغياب YYYY-MM-DD"
                            placeholderTextColor="#d7b3c4"
                          />
                          <TextInput
                            style={styles.inputFull}
                            value={absenceNoteInput}
                            onChangeText={setAbsenceNoteInput}
                            placeholder="ملاحظة الغياب (اختياري)"
                            placeholderTextColor="#d7b3c4"
                          />
                          <Pressable
                            style={[
                              styles.primaryButton,
                              !canManageInventory && styles.buttonDisabled,
                            ]}
                            disabled={!canManageInventory}
                            onPress={addEmployeeAbsence}
                          >
                            <Text style={styles.primaryButtonText}>
                              تسجيل الغياب
                            </Text>
                          </Pressable>
                        </>
                      )}

                      {recentAbsenceRows.length > 0 && (
                        <View style={styles.sectionActions}>
                          {recentAbsenceRows.map((entry) => {
                            const employee = selectedStoreEmployees.find(
                              (item) => item.id === entry.employeeId,
                            );
                            return (
                              <View key={entry.id} style={styles.orderRow}>
                                <View style={styles.orderRowMain}>
                                  <Text style={styles.orderRowId}>
                                    {employee?.name ?? "موظف غير معروف"}
                                  </Text>
                                  <Text style={styles.orderRowItems}>
                                    {entry.absenceDate}
                                  </Text>
                                </View>
                                {entry.note ? (
                                  <Text style={styles.orderRowMeta}>
                                    {entry.note}
                                  </Text>
                                ) : null}
                                {canManageInventory && (
                                  <View style={styles.rowActionButtons}>
                                    <Pressable
                                      style={styles.dangerButton}
                                      onPress={() =>
                                        removeEmployeeAbsence(entry.id)
                                      }
                                    >
                                      <Text style={styles.dangerButtonText}>
                                        حذف
                                      </Text>
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>تسجيل سحبة</Text>
                      {selectedStoreEmployees.length === 0 ? (
                        <Text style={styles.emptyText}>
                          أضف موظف أولاً لتسجيل السحوبات.
                        </Text>
                      ) : (
                        <>
                          <View style={styles.categoryRow}>
                            {selectedStoreEmployees.map((employee) => {
                              const selected =
                                withdrawalEmployeeIdInput === employee.id;
                              return (
                                <Pressable
                                  key={employee.id}
                                  style={[
                                    styles.storeChip,
                                    selected && styles.storeChipSelected,
                                  ]}
                                  onPress={() =>
                                    setWithdrawalEmployeeIdInput(employee.id)
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.storeChipText,
                                      selected && styles.storeChipTextSelected,
                                    ]}
                                  >
                                    {employee.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <View style={styles.inputRow}>
                            <TextInput
                              style={styles.input}
                              value={withdrawalDateInput}
                              onChangeText={setWithdrawalDateInput}
                              placeholder="تاريخ السحبة YYYY-MM-DD"
                              placeholderTextColor="#d7b3c4"
                            />
                            <TextInput
                              style={styles.input}
                              value={withdrawalAmountInput}
                              onChangeText={setWithdrawalAmountInput}
                              keyboardType="decimal-pad"
                              placeholder="المبلغ"
                              placeholderTextColor="#d7b3c4"
                            />
                          </View>
                          <TextInput
                            style={styles.inputFull}
                            value={withdrawalNoteInput}
                            onChangeText={setWithdrawalNoteInput}
                            placeholder="ملاحظة السحبة (اختياري)"
                            placeholderTextColor="#d7b3c4"
                          />
                          <Pressable
                            style={[
                              styles.primaryButton,
                              !canManageInventory && styles.buttonDisabled,
                            ]}
                            disabled={!canManageInventory}
                            onPress={addEmployeeWithdrawal}
                          >
                            <Text style={styles.primaryButtonText}>
                              تسجيل السحبة
                            </Text>
                          </Pressable>
                        </>
                      )}

                      {recentWithdrawalRows.length > 0 && (
                        <View style={styles.sectionActions}>
                          {recentWithdrawalRows.map((entry) => {
                            const employee = selectedStoreEmployees.find(
                              (item) => item.id === entry.employeeId,
                            );
                            return (
                              <View key={entry.id} style={styles.orderRow}>
                                <View style={styles.orderRowMain}>
                                  <Text style={styles.orderRowId}>
                                    {employee?.name ?? "موظف غير معروف"}
                                  </Text>
                                  <Text style={styles.orderRowItems}>
                                    {entry.withdrawalDate}
                                  </Text>
                                </View>
                                <View style={styles.orderRowMain}>
                                  <Text style={styles.orderRowTotal}>
                                    {formatMoney(entry.amount)}
                                  </Text>
                                </View>
                                {entry.note ? (
                                  <Text style={styles.orderRowMeta}>
                                    {entry.note}
                                  </Text>
                                ) : null}
                                {canManageInventory && (
                                  <View style={styles.rowActionButtons}>
                                    <Pressable
                                      style={styles.dangerButton}
                                      onPress={() =>
                                        removeEmployeeWithdrawal(entry.id)
                                      }
                                    >
                                      <Text style={styles.dangerButtonText}>
                                        حذف
                                      </Text>
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </>
  );
}
