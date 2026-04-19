import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import WithdrawModal from './components/WithdrawModal';
import AdminStats from './components/AdminStats';
import AdminTariffs from './components/AdminTariffs';
import AdminFaq from './components/AdminFaq';
import ClientCatalog from './components/ClientCatalog';
import ClientFaq from './components/ClientFaq';

declare global {
  interface Window {
    Telegram: any;
  }
}

const translations = {
  ru: {
    adminTitle: "Панель Основателя",
    adminSubtitle: "Глобальная статистика",
    overview: "Обзор проекта",
    overviewDesc: "Все пользователи и активные заказы.",
    totalUsers: "Всего юзеров",
    totalSales: "Выручка",
    manageManagers: "Управление Менеджерами",
    assignEmployee: "Назначить сотрудника",
    enterTgId: "Введите Telegram ID",
    activeEmployees: "Действующие сотрудники",
    managerAddError: "ОШИБКА: Этот пользователь еще ни разу не запускал бота! Пусть нажмет /start в боте.",
    managerAddSuccess: "Успех! ID {id} теперь {role}.",
    managerRemoveSuccess: "Сотрудник {id} удален.",
    managerAddFail: "Ошибка при добавлении.",
    ownerBadge: "Владелец",
    adminBadge: "Админ",
    managerBadge: "Менеджер",
    selectAdmin: "Админ",
    selectManager: "Менеджер",
    roleLabel: "Роль:",
    balance: "Баланс",
    invitedCount: "Приглашены",
    userTitle: "Бонусы",
    userSubtitle: "Твоя статистика",
    bonusBalance: "Твой бонусный баланс",
    withdraw: "Вывести",
    invitedLabel: "Приглашено",
    boughtEsimLabel: "Активаций",
    inviteFriend: "Пригласить друга",
    tabReferral: "Бонусы",
    tabCatalog: "Каталог",
    tabStats: "Статистика",
    tabTariffs: "Тарифы",
    tabFaq: "FAQ",
    loginTitle: "Вход в панель",
    loginDesc: "Открыто вне Telegram. Введите свой Telegram ID для доступа.",
    loginPlaceholder: "Введите ID (например, 12345678)",
    loginBtn: "Войти",
    loading: "Загрузка данных...",
    linkCopied: "Ссылка скопирована!",
    promoTitle: "Поделись ссылкой или Промокодом:",
    promoLabel: "ПРОМОКОД",
    getQrChat: "Получить QR в чат",
    enterPromoPlaceholder: "Введите промокод (ID друга)",
    applyPromoBtn: "Применить",
    promoSuccess: "Промокод успешно применён!",
    promoError: "Неверный промокод или ошибка.",
    // Admin Tariffs
    manageTariffs: "Управление тарифами",
    addTariff: "Добавить",
    newTariff: "Новый тариф",
    editTariff: "Редактировать",
    sortNumber: "Сортировка (1, 2...)",
    country: "Страна (Turkiye, Europe)",
    traffic: "Трафик (1 Gb, unlimited)",
    validity: "Срок (7 days)",
    price: "Цена USD (10.50)",
    qrLink: "QR ссылка (https://...)",
    paymentLink: "Ссылка на оплату (https://...)",
    isActive: "Активен",
    saveBtn: "Сохранить",
    cancelBtn: "Отмена",
    deleteConfirm: "Точно удалить тариф?",
    linkQr: "QR",
    linkPay: "Оплата",
    // Admin FAQ
    manageFaq: "Управление FAQ",
    addFaq: "Добавить",
    newFaq: "Новый FAQ",
    editFaq: "Редактировать",
    faqTopic: "Тема / Вопрос",
    faqContent: "Ответ (на русском)...",
    deleteFaqConfirm: "Точно удалить этот вопрос?",
    // Admin Stats
    tabOrders: "Заказы",
    tabUsers: "Юзеры",
    analyzing: "Анализ базы...",
    noOrders: "Нет заказов",
    invitedLabelStats: "ПРИГЛАСИЛ:",
    purchasesLabel: "ПОКУПОК:",
    spentLabel: "Потратил",
    hideAll: "Скрыть ⬆",
    showAll: "Показать все ({count}) ⬇",
    deletedTariff: "Удаленный тариф",
    unknownUser: "Неизвестный",
    statuses: {
      all: "ВСЕ",
      paid: "ОПЛАЧЕН",
      pending: "В ОЖИДАНИИ",
      awaiting_qr: "ЖДЕТ QR",
      cancelled: "ОТМЕНЕН"
    },
    commissionLabel: "комиссия",
    notePlaceholder: "Имя или заметка...",
    refDealsLabel: "СДЕЛОК ПО РЕФКЕ:",
    ownPurchasesLabel: "СВОИ ПОКУПКИ:",
    refVolumeLabel: "ОБЪ. РЕФЕРАЛОВ",
    commissionLabelAdmin: "КОМИССИЯ",
    viewRefDealsBtn: "Смотреть сделки рефералов",
    payoutBtn: "Выплатить",
    payoutHistoryLabel: "История выплат:",
    refDealsTitle: "Сделки рефералов",
    confirmPayout: "Выплатить {amount}$ пользователю?\nБаланс будет обнулен.",
    readMore: "Читать далее",
    noFaq: "Инструкций пока нет",
    loadingFaq: "Загрузка инструкций...",
  },
  tr: {
    adminTitle: "Kurucu Paneli",
    adminSubtitle: "Küresel İstatistikler",
    overview: "Proje İncelemesi",
    overviewDesc: "Tüm kullanıcılar ve aktif siparişler.",
    totalUsers: "Toplam Kullanıcı",
    totalSales: "Ciro",
    manageManagers: "Yönetici Yönetimi",
    assignEmployee: "Çalışan Ata",
    enterTgId: "Telegram ID girin",
    activeEmployees: "Aktif Çalışanlar",
    managerAddError: "HATA: Bu kullanıcı botu hiç başlatmamış! Botta /start'a bassın.",
    managerAddSuccess: "Başarı! ID {id} artık Yönetici.",
    managerRemoveSuccess: "Çalışan {id} kaldırıldı.",
    managerAddFail: "Yönetici eklerken hata oluştu.",
    ownerBadge: "Sahibi",
    balance: "Bakiye",
    invitedCount: "Kişi",
    userTitle: "Bonuslar",
    userSubtitle: "İstatistiklerin",
    bonusBalance: "Bonus Bakiyen",
    withdraw: "Para Çek",
    invitedLabel: "Davet Edildi",
    boughtEsimLabel: "Aktivasyonlar",
    inviteFriend: "Arkadaş Davet Et",
    tabReferral: "Bonuslar",
    tabCatalog: "Katalog",
    tabStats: "İstatistik",
    tabTariffs: "Tarifeler",
    tabFaq: "SSS",
    loginTitle: "Panele Giriş",
    loginDesc: "Telegram dışında açıldı. Erişim için Telegram ID'nizi girin.",
    loginPlaceholder: "ID girin (örn. 12345678)",
    loginBtn: "Giriş Yap",
    loading: "Veriler yükleniyor...",
    linkCopied: "Bağlantı kopyalandı!",
    promoTitle: "Bağlantınızı veya Promosyon Kodunuzu paylaşın:",
    promoLabel: "PROMO",
    getQrChat: "QR'ı Sohbete Al",
    enterPromoPlaceholder: "Arkadaşınızın kodunu (ID) girin",
    applyPromoBtn: "Uygula",
    promoSuccess: "Promosyon kodu uygulandı!",
    promoError: "Geçersiz kod veya hata.",
    // Admin Tariffs
    manageTariffs: "Tarife Yönetimi",
    addTariff: "Ekle",
    newTariff: "Yeni Tarife",
    editTariff: "Düzenle",
    sortNumber: "Sıralama (1, 2...)",
    country: "Ülke (Türkiye, Europe)",
    traffic: "İnternet (1 GB, sınırsız)",
    validity: "Süre (7 gün)",
    price: "Fiyat USD (10.50)",
    qrLink: "QR Bağlantısı (https://...)",
    paymentLink: "Ödeme Bağlantısı (https://...)",
    isActive: "Aktif",
    saveBtn: "Kaydet",
    cancelBtn: "İptal",
    deleteConfirm: "Tarifi silmek istediğinize emin misiniz?",
    linkQr: "QR",
    linkPay: "Ödeme",
    // Admin FAQ
    manageFaq: "SSS Yönetimi",
    addFaq: "Ekle",
    newFaq: "Yeni SSS",
    editFaq: "Düzenle",
    faqTopic: "Konu / Soru",
    faqContent: "Cevap (Rusça)...",
    deleteFaqConfirm: "Bu soruyu silmek istediğinize emin misiniz?",
    // Admin Stats
    tabOrders: "Siparişler",
    tabUsers: "Kullanıcılar",
    analyzing: "Veritabanı Analizi...",
    noOrders: "Sipariş Yok",
    invitedLabelStats: "DAVET ETTİ:",
    purchasesLabel: "SATIN ALMALAR:",
    spentLabel: "Harcadı",
    hideAll: "Gizle ⬆",
    showAll: "Tümünü Göster ({count}) ⬇",
    deletedTariff: "Silinmiş Tarife",
    unknownUser: "Bilinmeyen",
    statuses: {
      all: "HEPSİ",
      paid: "ÖDENDİ",
      pending: "BEKLİYOR",
      awaiting_qr: "QR BEKLİYOR",
      cancelled: "İPTAL"
    },
    commissionLabel: "komisyon",
    notePlaceholder: "İsim veya not...",
    refDealsLabel: "REF İŞLEMLERİ:",
    ownPurchasesLabel: "KENDİ SATIN ALMALARI:",
    refVolumeLabel: "REF HACMİ",
    commissionLabelAdmin: "KOMİSYON",
    viewRefDealsBtn: "Referans işlemlerini gör",
    payoutBtn: "Ödeme Yap",
    payoutHistoryLabel: "Ödeme geçmişi:",
    refDealsTitle: "Referans İşlemleri",
    confirmPayout: "Kullanıcıya {amount}$ ödensin mi?\nBakiye sıfırlanacak.",
    readMore: "Devamını oku",
    noFaq: "Henüz talimat yok",
    loadingFaq: "Talimatlar yükleniyor...",
  },
  en: {
    adminTitle: "Founder Panel",
    adminSubtitle: "Global Statistics",
    overview: "Project Overview",
    overviewDesc: "All users and active orders.",
    totalUsers: "Total Users",
    totalSales: "Revenue",
    manageManagers: "Manager Management",
    assignEmployee: "Assign Employee",
    enterTgId: "Enter Telegram ID",
    activeEmployees: "Active Employees",
    managerAddError: "ERROR: This user hasn't started the bot! Tell them to press /start.",
    managerAddSuccess: "Success! ID {id} is now a Manager.",
    managerRemoveSuccess: "Employee {id} removed.",
    managerAddFail: "Error adding manager.",
    ownerBadge: "Owner",
    balance: "Balance",
    invitedCount: "Invited",
    userTitle: "Bonuses",
    userSubtitle: "Your Statistics",
    bonusBalance: "Your Bonus Balance",
    withdraw: "Withdraw",
    invitedLabel: "Invited",
    boughtEsimLabel: "Activations",
    inviteFriend: "Invite a Friend",
    tabReferral: "Bonuses",
    tabCatalog: "Catalog",
    tabStats: "Stats",
    tabTariffs: "Tariffs",
    tabFaq: "FAQ",
    loginTitle: "Panel Login",
    loginDesc: "Opened outside of Telegram. Enter your Telegram ID for access.",
    loginPlaceholder: "Enter ID (e.g., 12345678)",
    loginBtn: "Login",
    loading: "Loading data...",
    linkCopied: "Link copied!",
    promoTitle: "Share your Link or Promo Code:",
    promoLabel: "PROMO",
    getQrChat: "Get QR in Chat",
    enterPromoPlaceholder: "Enter friend's code (ID)",
    applyPromoBtn: "Apply",
    promoSuccess: "Promo code applied!",
    promoError: "Invalid code or error.",
    // Admin Tariffs
    manageTariffs: "Tariff Management",
    addTariff: "Add",
    newTariff: "New Tariff",
    editTariff: "Edit",
    sortNumber: "Sort (1, 2...)",
    country: "Country (Turkiye, Europe)",
    traffic: "Traffic (1 GB, unlimited)",
    validity: "Validity (7 days)",
    price: "Price USD (10.50)",
    qrLink: "QR Link (https://...)",
    paymentLink: "Payment Link (https://...)",
    isActive: "Active",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    deleteConfirm: "Are you sure you want to delete this tariff?",
    linkQr: "QR",
    linkPay: "Pay",
    // Admin FAQ
    manageFaq: "FAQ Management",
    addFaq: "Add",
    newFaq: "New FAQ",
    editFaq: "Edit",
    faqTopic: "Topic / Question",
    faqContent: "Answer (in Russian)...",
    deleteFaqConfirm: "Are you sure you want to delete this question?",
    // Admin Stats
    tabOrders: "Orders",
    tabUsers: "Users",
    analyzing: "Database Analysis...",
    noOrders: "No Orders",
    invitedLabelStats: "INVITED:",
    purchasesLabel: "PURCHASES:",
    spentLabel: "Spent",
    hideAll: "Hide ⬆",
    showAll: "Show All ({count}) ⬇",
    deletedTariff: "Deleted Tariff",
    unknownUser: "Unknown",
    statuses: {
      all: "ALL",
      paid: "PAID",
      pending: "PENDING",
      awaiting_qr: "AWAITING QR",
      cancelled: "CANCELLED"
    },
    commissionLabel: "commission",
    notePlaceholder: "Name or note...",
    refDealsLabel: "REF DEALS:",
    ownPurchasesLabel: "OWN PURCHASES:",
    refVolumeLabel: "REF VOLUME",
    commissionLabelAdmin: "COMMISSION",
    viewRefDealsBtn: "View referral deals",
    payoutBtn: "Payout",
    payoutHistoryLabel: "Payout history:",
    refDealsTitle: "Referral deals",
    confirmPayout: "Payout {amount}$ to user?\nBalance will be reset.",
    readMore: "Read more",
    noFaq: "No instructions yet",
    loadingFaq: "Loading instructions...",
  },
  de: {
    adminTitle: "Gründer-Panel",
    adminSubtitle: "Globale Statistiken",
    overview: "Projektübersicht",
    overviewDesc: "Alle Nutzer und aktive Bestellungen.",
    totalUsers: "Gesamte Nutzer",
    totalSales: "Einnahmen",
    manageManagers: "Manager-Verwaltung",
    assignEmployee: "Mitarbeiter zuweisen",
    enterTgId: "Telegram-ID eingeben",
    activeEmployees: "Aktive Mitarbeiter",
    managerAddError: "FEHLER: Dieser Nutzer hat den Bot noch nie gestartet! Er muss /start drücken.",
    managerAddSuccess: "Erfolg! ID {id} ist jetzt ein Manager.",
    managerRemoveSuccess: "Mitarbeiter {id} entfernt.",
    managerAddFail: "Fehler beim Hinzufügen des Managers.",
    ownerBadge: "Eigentümer",
    balance: "Guthaben",
    invitedCount: "Eingeladen",
    userTitle: "Boni",
    userSubtitle: "Deine Statistik",
    bonusBalance: "Dein Bonusguthaben",
    withdraw: "Auszahlen",
    invitedLabel: "Eingeladen",
    boughtEsimLabel: "Aktivierungen",
    inviteFriend: "Einen Freund einladen",
    tabReferral: "Boni",
    tabCatalog: "Katalog",
    tabStats: "Statistik",
    tabTariffs: "Tarife",
    tabFaq: "FAQ",
    loginTitle: "Panel Login",
    loginDesc: "Außerhalb von Telegram geöffnet. ID eingeben.",
    loginPlaceholder: "ID eingeben (z. B. 12345678)",
    loginBtn: "Anmelden",
    loading: "Lade Daten...",
    linkCopied: "Link kopiert!",
    promoTitle: "Teile deinen Link oder Promo-Code:",
    promoLabel: "PROMO",
    getQrChat: "QR im Chat abrufen",
    enterPromoPlaceholder: "Code (ID) eintragen",
    applyPromoBtn: "Anwenden",
    promoSuccess: "Promo-Code angewendet!",
    promoError: "Ungültiger Code oder Fehler.",
    manageTariffs: "Tarifverwaltung",
    addTariff: "Hinzufügen",
    newTariff: "Neuer Tarif",
    editTariff: "Bearbeiten",
    sortNumber: "Sortierung (1, 2...)",
    country: "Land (z.B. Turkiye)",
    traffic: "Daten (1 GB, unbegrenzt)",
    validity: "Gültigkeit (7 Tage)",
    price: "Preis USD (10.50)",
    qrLink: "QR-Link (https://...)",
    paymentLink: "Zahlungslink (https://...)",
    isActive: "Aktiv",
    saveBtn: "Speichern",
    cancelBtn: "Abbrechen",
    deleteConfirm: "Diesen Tarif wirklich löschen?",
    linkQr: "QR",
    linkPay: "Zahlen",
    manageFaq: "FAQ-Verwaltung",
    addFaq: "Hinzufügen",
    newFaq: "Neue FAQ",
    editFaq: "Bearbeiten",
    faqTopic: "Thema / Frage",
    faqContent: "Antwort...",
    deleteFaqConfirm: "Diese Frage wirklich löschen?",
    tabOrders: "Bestellungen",
    tabUsers: "Nutzer",
    analyzing: "Analysiere...",
    noOrders: "Keine Bestellungen",
    invitedLabelStats: "EINGELADEN:",
    purchasesLabel: "KÄUFE:",
    spentLabel: "Ausgegeben",
    hideAll: "Verbergen ⬆",
    showAll: "Alle zeigen ({count}) ⬇",
    deletedTariff: "Gelöschter Tarif",
    unknownUser: "Unbekannt",
    statuses: {
      all: "ALLE",
      paid: "BEZAHLT",
      pending: "AUSSTEHEND",
      awaiting_qr: "QR ERWARTET",
      cancelled: "ABGEBROCHEN"
    },
    commissionLabel: "Provision",
    notePlaceholder: "Name oder Notiz...",
    refDealsLabel: "REF-DEALS:",
    ownPurchasesLabel: "EIGENE KÄUFE:",
    refVolumeLabel: "REF-VOLUMEN",
    commissionLabelAdmin: "PROVISION",
    viewRefDealsBtn: "Referral-Deals anzeigen",
    payoutBtn: "Auszahlen",
    payoutHistoryLabel: "Auszahlungshistorie:",
    refDealsTitle: "Referral-Deals",
    confirmPayout: "{amount}$ an Nutzer auszahlen?\nGuthaben wird zurückgesetzt.",
    readMore: "Weiterlesen",
    noFaq: "Noch keine Anleitungen",
    loadingFaq: "Anleitungen werden geladen...",
  },
  pl: {
    adminTitle: "Panel Założyciela",
    adminSubtitle: "Globalne Statystyki",
    overview: "Przegląd projektu",
    overviewDesc: "Wszyscy użytkownicy i aktywne zamówienia.",
    totalUsers: "Całkowita liczba użytkowników",
    totalSales: "Przychody",
    manageManagers: "Zarządzanie menedżerami",
    assignEmployee: "Przypisz pracownika",
    enterTgId: "Wprowadź Telegram ID",
    activeEmployees: "Aktywni pracownicy",
    managerAddError: "BŁĄD: Ten użytkownik nigdy nie uruchomił bota! Niech kliknie /start.",
    managerAddSuccess: "Sukces! ID {id} to teraz Menedżer.",
    managerRemoveSuccess: "Pracownik {id} usunięty.",
    managerAddFail: "Błąd podczas dodawania menedżera.",
    ownerBadge: "Właściciel",
    balance: "Saldo",
    invitedCount: "Zaproszeni",
    userTitle: "Bonusy",
    userSubtitle: "Twoje Statystyki",
    bonusBalance: "Twoje Saldo Bonusowe",
    withdraw: "Wypłać",
    invitedLabel: "Zaproszono",
    boughtEsimLabel: "Aktywacje",
    inviteFriend: "Zaproś przyjaciela",
    tabReferral: "Bonusy",
    tabCatalog: "Katalog",
    tabStats: "Statystyki",
    tabTariffs: "Taryfy",
    tabFaq: "FAQ",
    loginTitle: "Logowanie",
    loginDesc: "Otwarte poza Telegramem. Wprowadź ID.",
    loginPlaceholder: "Wprowadź ID (np. 12345678)",
    loginBtn: "Zaloguj",
    loading: "Ładowanie danych...",
    linkCopied: "Link skopiowany!",
    promoTitle: "Udostępnij link lub kod promocyjny:",
    promoLabel: "PROMO",
    getQrChat: "Odbierz QR w czacie",
    enterPromoPlaceholder: "Wprowadź kod przyjaciela (ID)",
    applyPromoBtn: "Zastosuj",
    promoSuccess: "Kod promocyjny użyty!",
    promoError: "Nieprawidłowy kod lub błąd.",
    manageTariffs: "Zarządzanie taryfami",
    addTariff: "Dodaj",
    newTariff: "Nowa Taryfa",
    editTariff: "Edytuj",
    sortNumber: "Sortowanie (1, 2...)",
    country: "Kraj (np. Turkiye)",
    traffic: "Internet (1 GB, nielimitowany)",
    validity: "Ważność (7 dni)",
    price: "Cena USD (10.50)",
    qrLink: "Link QR (https://...)",
    paymentLink: "Link do płatności (https://...)",
    isActive: "Aktywny",
    saveBtn: "Zapisz",
    cancelBtn: "Anuluj",
    deleteConfirm: "Czy na pewno usunąć tę taryfę?",
    linkQr: "QR",
    linkPay: "Płać",
    manageFaq: "Zarządzanie FAQ",
    addFaq: "Dodaj",
    newFaq: "Nowe FAQ",
    editFaq: "Edytuj",
    faqTopic: "Temat / Pytanie",
    faqContent: "Odpowiedź...",
    deleteFaqConfirm: "Czy na pewno usunąć to pytanie?",
    tabOrders: "Zamówienia",
    tabUsers: "Użytkownicy",
    analyzing: "Analiza...",
    noOrders: "Brak Zamówień",
    invitedLabelStats: "ZAPROSIŁ:",
    purchasesLabel: "ZAKUPY:",
    spentLabel: "Wydane",
    hideAll: "Ukryj ⬆",
    showAll: "Pokaż wszystkie ({count}) ⬇",
    deletedTariff: "Usunięta Taryfa",
    unknownUser: "Nieznany",
    statuses: {
      all: "WSZYSTKIE",
      paid: "OPŁACONE",
      pending: "OCZEKUJĄCE",
      awaiting_qr: "CZĘKA NA QR",
      cancelled: "ANULOWANE"
    },
    commissionLabel: "prowizja",
    notePlaceholder: "Imię lub notatka...",
    refDealsLabel: "TRANSAKCJE REF:",
    ownPurchasesLabel: "WŁASNE ZAKUPY:",
    refVolumeLabel: "WOLUMEN REF",
    commissionLabelAdmin: "PROWIZJA",
    viewRefDealsBtn: "Zobacz transakcje poleconych",
    payoutBtn: "Wypłać",
    payoutHistoryLabel: "Historia wypłat:",
    refDealsTitle: "Transakcje poleconych",
    confirmPayout: "Wypłacić {amount}$ użytkownikowi?\nSaldo zostanie zresetowane.",
    readMore: "Czytaj więcej",
    noFaq: "Brak instrukcji",
    loadingFaq: "Ładowanie instrukcji...",
  },
  ar: {
    adminTitle: "لوحة المؤسس",
    adminSubtitle: "إحصائيات عالمية",
    overview: "نظرة عامة",
    overviewDesc: "جميع المستخدمين والطلبات.",
    totalUsers: "إجمالي المستخدمين",
    totalSales: "الإيرادات",
    manageManagers: "إدارة المديرين",
    assignEmployee: "تعيين موظف",
    enterTgId: "أدخل معرّف تيليجرام",
    activeEmployees: "الموظفون النشطون",
    managerAddError: "خطأ: لم يبدأ الروبوت! اضغط /start.",
    managerAddSuccess: "نجاح! {id} مدير الآن.",
    managerRemoveSuccess: "تمت إزالة الموظف {id}.",
    managerAddFail: "خطأ اثناء الإضافة.",
    ownerBadge: "مالك",
    balance: "الرصيد",
    invitedCount: "المدعوون",
    userTitle: "المكافآت",
    userSubtitle: "إحصائياتك",
    bonusBalance: "رصيد مكافآتك",
    withdraw: "سحب",
    invitedLabel: "تمت الدعوة",
    boughtEsimLabel: "التنشيطات",
    inviteFriend: "دعوة صديق",
    tabReferral: "مكافآت",
    tabCatalog: "الكتالوج",
    tabStats: "إحصائيات",
    tabTariffs: "الخطط",
    tabFaq: "أسئلة مكررة",
    loginTitle: "تسجيل الدخول",
    loginDesc: "خارج تيليجرام. أدخل هويتك.",
    loginPlaceholder: "المعرّف (12345678)",
    loginBtn: "دخول",
    loading: "جاري التحميل...",
    linkCopied: "تم نسخ الرابط!",
    promoTitle: "شارك رابطك أو كودك:",
    promoLabel: "الترويجي",
    getQrChat: "QR في الشات",
    enterPromoPlaceholder: "كود الصديق",
    applyPromoBtn: "تطبيق",
    promoSuccess: "تم التطبيق!",
    promoError: "رمز غير صالح.",
    manageTariffs: "إدارة الخطط",
    addTariff: "إضافة",
    newTariff: "خطة جديدة",
    editTariff: "تعديل",
    sortNumber: "الترتيب",
    country: "البلد",
    traffic: "بيانات",
    validity: "صلاحية",
    price: "السعر",
    qrLink: "رابط QR",
    paymentLink: "رابط الدفع",
    isActive: "نشط",
    saveBtn: "حفظ",
    cancelBtn: "إلغاء",
    deleteConfirm: "تأكيد الحذف؟",
    linkQr: "رمز QR",
    linkPay: "دفع",
    manageFaq: "إدارة FAQ",
    addFaq: "إضافة",
    newFaq: "سؤال جديد",
    editFaq: "تعديل",
    faqTopic: "السؤال",
    faqContent: "الجواب",
    deleteFaqConfirm: "تأكيد الحذف؟",
    tabOrders: "الطلبات",
    tabUsers: "المستخدمون",
    analyzing: "تحليل...",
    noOrders: "لا طلبات",
    invitedLabelStats: "دعا:",
    purchasesLabel: "مشتريات:",
    spentLabel: "أنفق",
    hideAll: "إخفاء ⬆",
    showAll: "عرض الكل ({count}) ⬇",
    deletedTariff: "خطة محذوفة",
    unknownUser: "مجهول",
    statuses: {
      all: "الكل",
      paid: "مدفوع",
      pending: "قيد الانتظار",
      awaiting_qr: "في انتظار QR",
      cancelled: "ملغي"
    },
    commissionLabel: "عمولة",
    notePlaceholder: "الاسم أو ملاحظة...",
    refDealsLabel: "صفقات الإحالة:",
    ownPurchasesLabel: "مشتريات خاصة:",
    refVolumeLabel: "حجم الإحالات",
    commissionLabelAdmin: "العمولة",
    viewRefDealsBtn: "عرض صفقات الإحالة",
    payoutBtn: "دفع",
    payoutHistoryLabel: "سجل الدفعات:",
    refDealsTitle: "صفقات الإحالة",
    confirmPayout: "دفع {amount}$ للمستخدم؟\nسيتم تصوير الرصيد.",
    readMore: "اقرأ أكثر",
    noFaq: "لا توجد تعليمات بعد",
    loadingFaq: "جاري تحميل التعليمات...",
  },
  fa: {
    adminTitle: "پنل مؤسس",
    adminSubtitle: "آمار جهانی",
    overview: "بررسی اجمالی",
    overviewDesc: "همه کاربران و سفارشات.",
    totalUsers: "کل کاربران",
    totalSales: "درآمد",
    manageManagers: "مدیریت مدیران",
    assignEmployee: "تخصیص کارمند",
    enterTgId: "شناسه تلگرام",
    activeEmployees: "کارمندان فعال",
    managerAddError: "خطا: کاربر وارد نشده. باید /start بزند.",
    managerAddSuccess: "موفق! {id} مدیر شد.",
    managerRemoveSuccess: "کارمند {id} حذف شد.",
    managerAddFail: "خطا در افزودن.",
    ownerBadge: "سازنده",
    balance: "موجودی",
    invitedCount: "دعوت شده",
    userTitle: "پاداش‌ها",
    userSubtitle: "آمار شما",
    bonusBalance: "موجودی پاداش شما",
    withdraw: "برداشت",
    invitedLabel: "دعوت شدگان",
    boughtEsimLabel: "فعال‌سازی",
    inviteFriend: "دعوت دوست",
    tabReferral: "پاداش",
    tabCatalog: "کاتالوگ",
    tabStats: "آمار",
    tabTariffs: "طرح‌ها",
    tabFaq: "سوالات متداول",
    loginTitle: "ورود",
    loginDesc: "خارج تلگرام. شناسه وارد کنید.",
    loginPlaceholder: "شناسه",
    loginBtn: "ورود",
    loading: "در حال بارگذاری...",
    linkCopied: "لینک کپی شد!",
    promoTitle: "اشتراک گذاری لینک یا کد:",
    promoLabel: "کد معرفی",
    getQrChat: "QR در چت",
    enterPromoPlaceholder: "کد دوست",
    applyPromoBtn: "اعمال",
    promoSuccess: "اعمال شد!",
    promoError: "خطا یا کد نامعتبر.",
    manageTariffs: "مدیریت طرح‌ها",
    addTariff: "افزودن",
    newTariff: "طرح جدید",
    editTariff: "ویرایش",
    sortNumber: "مرتب سازی",
    country: "کشور",
    traffic: "داده",
    validity: "اعتبار",
    price: "قیمت",
    qrLink: "لینک QR",
    paymentLink: "لینک پرداخت",
    isActive: "فعال",
    saveBtn: "ذخیره",
    cancelBtn: "لغو",
    deleteConfirm: "حذف شود؟",
    linkQr: "کد QR",
    linkPay: "پرداخت",
    manageFaq: "مدیریت FAQ",
    addFaq: "افزودن",
    newFaq: "سوال جدید",
    editFaq: "ویرایش",
    faqTopic: "موضوع / سوال",
    faqContent: "پاسخ",
    deleteFaqConfirm: "حذف شود؟",
    tabOrders: "سفارشات",
    tabUsers: "کاربران",
    analyzing: "در حال تحلیل...",
    noOrders: "سفارشی نیست",
    invitedLabelStats: "دعوت کرد:",
    purchasesLabel: "خریدها:",
    spentLabel: "خرج کرد",
    hideAll: "پنهان ⬆",
    showAll: "نمایش همه ({count}) ⬇",
    deletedTariff: "طرح حذف شده",
    unknownUser: "ناشناس",
    statuses: {
      all: "همه",
      paid: "پرداخت شد",
      pending: "در انتظار",
      awaiting_qr: "منتظر QR",
      cancelled: "لغو شد"
    },
    commissionLabel: "کمیسیون",
    readMore: "ادامه مطلب",
    noFaq: "هنوز دستورالعملی وجود ندارد",
    loadingFaq: "در حال بارگذاری دستورالعمل‌ها...",
  },
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loginInputId, setLoginInputId] = useState('');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [purchasedRefsCount, setPurchasedRefsCount] = useState(0);
  const [payoutsHistory, setPayoutsHistory] = useState<any[]>([]);
  const [globalStats, setGlobalStats] = useState({ totalUsers: 0, totalOrders: 0, totalSales: 0, user: null as any });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lang, setLang] = useState<string>('ru');

  const [activeTab, setActiveTab] = useState<'referral' | 'catalog' | 'stats' | 'tariffs' | 'faq'>('catalog');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    const init = async () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }

      let tgUser: any = null;

      // 1. Try secure Telegram Hash validation (Priority)
      if (tg?.initData) {
        try {
          const resp = await fetch('/api/validate-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData })
          });
          const result = await resp.json();
          if (result.ok && result.user) {
            tgUser = result.user;
            console.log('[AUTH] Hash verified successfully');
          }
        } catch (e) {
          console.error('[AUTH] Hash verification service error:', e);
        }
      }

      // 2. Fallback to URL Parameters (uid=) - useful for dev/testing or Desktop
      if (!tgUser?.id) {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get('uid');
        if (uid && !isNaN(parseInt(uid))) {
          await fetchUserData(parseInt(uid));
          return;
        }
      }

      // 3. Fallback to Telegram SDK unsafe data (last resort)
      if (!tgUser?.id) {
        for (let i = 0; i < 5; i++) {
          tgUser = tg?.initDataUnsafe?.user;
          if (tgUser?.id) break;
          await new Promise(r => setTimeout(r, 200));
        }
      }

      if (tgUser?.id) {
        const supportedLangs = ['ru', 'en', 'tr', 'de', 'pl', 'ar', 'fa'];
        const userLang = tgUser.language_code?.toLowerCase();
        if (userLang && supportedLangs.includes(userLang)) {
          setLang(userLang);
        }
        await fetchUserData(tgUser.id, tgUser.first_name, tgUser.username);
      } else {
        setLoading(false);
      }
    };
    init();
  }, []);

  const t = translations[lang as keyof typeof translations] || translations['en'];



  const renderLangSwitcher = () => (
    <div className="relative">
      <button
        id="lang-selector-btn"
        onClick={() => setShowLangDropdown(!showLangDropdown)}
        className="bg-[#2a2a2f] hover:bg-[#323238] px-3 py-1.5 rounded-full text-[10px] font-extrabold text-slate-100 flex items-center gap-1.5 transition-all border border-white/10 active:scale-95 shadow-lg"
      >
        <span className="material-symbols-outlined text-[14px] text-primary">language</span>
        {lang.toUpperCase()}
      </button>

      {showLangDropdown && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]" 
            onClick={() => setShowLangDropdown(false)} 
          />
          
          {/* Dropdown Menu */}
          <div className="fixed top-12 right-6 w-40 bg-[#1a1a1f] border border-white/10 rounded-2xl shadow-2xl z-[101] overflow-hidden py-1.5 animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="px-4 py-2 border-b border-white/5 mb-1">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Select Language</p>
            </div>
            {['ru', 'en', 'tr', 'de', 'pl', 'ar', 'fa'].map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  setShowLangDropdown(false);
                }}
                className={`w-full text-left px-4 py-3 text-xs font-bold transition-all flex items-center justify-between border-l-4 ${lang === l ? 'text-primary bg-primary/10 border-primary' : 'text-slate-300 border-transparent hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">
                    {l === 'ru' ? '🇷🇺' : l === 'en' ? '🇺🇸' : l === 'tr' ? '🇹🇷' : l === 'de' ? '🇩🇪' : l === 'pl' ? '🇵🇱' : l === 'ar' ? '🇦🇪' : '🇮🇷'}
                  </span>
                  <span>{l === 'ru' ? 'Русский' : l === 'en' ? 'English' : l === 'tr' ? 'Türkçe' : l === 'de' ? 'Deutsch' : l === 'pl' ? 'Polski' : l === 'ar' ? 'العربية' : 'فارسی'}</span>
                </div>
                {lang === l && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const fetchUserData = async (tgId: number, firstName?: string, username?: string) => {
    try {
      setLoading(true);
      const { data: userData, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tgId)
        .single();

      let currentUser = userData;

      // САМОРЕГ: Если пользователя нет в БД — создаем его
      if (!userData && (fetchErr?.code === 'PGRST116' || !fetchErr)) {
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        const newUser = {
          telegram_id: tgId,
          username: username || firstName || tgUser?.first_name || `user_${tgId}`,
          role: 'client',
          balance: 0
        };
        const { data: created, error: regError } = await supabase.from('users').insert(newUser).select().single();
        if (created) {
          currentUser = created;
          console.log('Self-registration successful for:', tgId);
        } else {
          console.error('Self-registration failed:', regError);
        }
      }

      if (currentUser) {
        setUser(currentUser);
        if (currentUser.role === 'founder' || currentUser.role === 'manager') {
          setActiveTab('stats');
        }

        const { data: refs } = await supabase
          .from('users')
          .select('telegram_id, username, created_at')
          .eq('referrer_id', tgId);

        setReferrals(refs || []);

        if (refs && refs.length > 0) {
          const refIds = refs.map((r: any) => r.telegram_id);
          const { data: orderedRefs } = await supabase
            .from('orders')
            .select('user_id')
            .in('user_id', refIds)
            .eq('status', 'paid');

          const uniqueBuyers = new Set((orderedRefs || []).map((o: any) => o.user_id));
          setPurchasedRefsCount(uniqueBuyers.size);
        }

        const { data: userPayouts } = await supabase.from('chat_history').select('content, created_at').eq('user_id', tgId).eq('role', 'assistant').like('content', 'PAYOUT_RECORD:%').order('created_at', { ascending: false });
        setPayoutsHistory(userPayouts || []);

        if (currentUser.role === 'founder' || currentUser.role === 'manager' || currentUser.role === 'admin') {
          let uCount = 0;
          let oCount = 0;
          let sumSales = 0;

          if (currentUser.role === 'manager') {
            const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('referrer_id', tgId);
            uCount = count || 0;

            const { data: refUsers } = await supabase.from('users').select('telegram_id').eq('referrer_id', tgId);
            if (refUsers && refUsers.length > 0) {
              const refIds = refUsers.map((u: any) => u.telegram_id);
              const { data: refOrders, count: refOrderCount } = await supabase.from('orders').select('price_usd', { count: 'exact' }).in('user_id', refIds).eq('status', 'paid');
              oCount = refOrderCount || 0;
              if (refOrders) {
                sumSales = refOrders.reduce((acc: number, order: any) => acc + (Number(order.price_usd) || 0), 0);
              }
            }
          } else {
            const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
            uCount = count || 0;
            const { data: paidOrdersList, count: totalOrderCount } = await supabase.from('orders').select('price_usd', { count: 'exact' }).eq('status', 'paid');
            oCount = totalOrderCount || 0;
            if (paidOrdersList) {
              sumSales = paidOrdersList.reduce((acc: number, order: any) => acc + (Number(order.price_usd) || 0), 0);
            }
          }

          setGlobalStats({
            totalUsers: uCount,
            totalOrders: oCount,
            totalSales: sumSales,
            user: currentUser
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refLink = user ? `https://t.me/emedeoesimworld_bot?start=${user.telegram_id}` : '';

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        tg?.showAlert(t.linkCopied);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      tg?.showAlert(t.linkCopied);
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
  };

  const handleManualLogin = async () => {
    if (!loginInputId) return;
    setLoading(true);
    await fetchUserData(parseInt(loginInputId));
  };

  if (loading) return <div className="p-8 text-center text-on-surface-variant font-body animate-pulse mt-20">{t.loading}</div>;

  if (!user) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-6 rounded-2xl w-full max-w-sm space-y-6 shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary-container/20 border border-primary/20 rounded-full mx-auto flex items-center justify-center mb-4 neon-glow">
              <span className="material-symbols-outlined text-primary text-3xl">login</span>
            </div>
            <h1 className="text-2xl font-headline font-bold text-slate-100">{t.loginTitle}</h1>
            <p className="text-sm font-body text-on-surface-variant">{t.loginDesc}</p>
          </div>
          <div className="space-y-4">
            <input
              type="number"
              value={loginInputId}
              onChange={(e) => setLoginInputId(e.target.value)}
              placeholder={t.loginPlaceholder}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 text-on-surface focus:outline-none focus:border-primary/50 text-center font-mono"
            />
            <button
              onClick={handleManualLogin}
              className="w-full bg-primary/20 text-primary border border-primary/30 py-3 rounded-xl font-bold shadow-[0_0_15px_rgba(208,188,255,0.1)] hover:bg-primary/30 transition-all active:scale-95"
            >
              {t.loginBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'founder' || user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isStaff = isAdmin || isManager;

  const renderAdminHeader = () => (
    <header className="px-6 pt-10 pb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-48 h-48 bg-secondary/10 rounded-full blur-[60px] -z-10 -translate-x-1/2 translate-y-1/4 pointer-events-none"></div>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-bold text-primary tracking-widest uppercase">{t.adminSubtitle}</p>
          <h1 className="text-3xl font-headline font-extrabold text-slate-100 flex items-center gap-2">{t.adminTitle}</h1>
        </div>
        {renderLangSwitcher()}
      </div>
    </header>
  );

  const renderUserHeader = () => (
    <header className="px-6 pt-10 pb-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-[80px] -z-10 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-sm font-bold text-secondary tracking-widest uppercase">{t.userSubtitle}</p>
          <h1 className="text-3xl font-headline font-extrabold text-slate-100 flex items-center gap-2">{t.userTitle}</h1>
        </div>
        {renderLangSwitcher()}
      </div>
    </header>
  );

  const renderAdminContent = () => {
    if (activeTab === 'tariffs') {
      return <AdminTariffs t={t} />;
    }
    if (activeTab === 'faq') {
      return isAdmin ? <AdminFaq t={t} /> : <ClientFaq lang={lang} t={t} />;
    }

    // Default to 'stats'
    return <AdminStats t={t} globalStats={globalStats} />;
  };

  const handleSendQr = async () => {
    if (!user?.telegram_id) return;
    try {
      tg?.showAlert("Отправляем QR в чат...");
      await fetch('/api/send-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: user.telegram_id })
      });
      tg?.close();
    } catch (err) {
      tg?.showAlert("Ошибка отправки QR");
    }
  };

  const renderUserContent = () => {
    if (activeTab === 'catalog') {
        const uid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || user?.telegram_id || null;
        return <ClientCatalog lang={lang} telegramId={uid} />;
    }
    if (activeTab === 'faq') {
        return <ClientFaq lang={lang} t={t} />;
    }

    return (
    <div className="space-y-6">
      <div className="bg-[#201f22] p-5 rounded-3xl relative overflow-hidden flex flex-col items-center text-center border border-white/5 mx-2">
        <div className="w-14 h-14 bg-secondary-container/20 border border-secondary/20 rounded-full flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-secondary text-2xl">account_balance_wallet</span>
        </div>
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">{t.bonusBalance}</p>
        <h2 className="text-4xl font-headline font-extrabold text-slate-100 mb-2">${user?.balance?.toFixed(2) || '0.00'}</h2>
        {(user?.balance || 0) > 0 && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-2 bg-primary/20 text-primary border border-primary/30 px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all"
          >
            {t.withdraw}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mx-2">
        <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-primary/10 p-1.5 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">group_add</span>
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.invitedLabel}</p>
          </div>
          <span className="text-2xl font-headline font-extrabold text-slate-200">{referrals.length}</span>
        </div>

        <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col justify-between min-h-[100px] border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-secondary/10 p-1.5 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-[18px]">shopping_bag</span>
            </div>
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{t.boughtEsimLabel}</p>
          </div>
          <span className="text-2xl font-headline font-extrabold text-slate-200">{purchasedRefsCount}</span>
        </div>
      </div>

      {payoutsHistory.length > 0 && (
        <div className="glass-card p-5 rounded-3xl mx-2 border border-white/5">
            <h3 className="text-sm font-headline font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-[18px]">history</span>
              {lang === 'ru' ? 'История выплат' : lang === 'tr' ? 'Ödeme Geçmişi' : 'Payout History'}
            </h3>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto clean-scrollbar pr-1">
              {payoutsHistory.map((p, idx) => (
                   <div key={idx} className="flex justify-between items-center bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/10">
                       <span className="text-xs text-on-surface-variant">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                       <span className="font-bold text-green-400 text-sm">+${Number(p.content.split(':')[1]).toFixed(2)}</span>
                   </div>
              ))}
            </div>
        </div>
      )}

      <div className="glass-card p-5 rounded-3xl mx-2 border border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px] -z-10 translate-x-1/2 -translate-y-1/2"></div>
        <h3 className="text-lg font-headline font-bold text-on-surface mb-3 flex items-center gap-2">
          {t.inviteFriend}
        </h3>
        <p className="text-sm font-medium text-on-surface-variant mb-4">{t.promoTitle}</p>

        <div className="space-y-3">
          <div 
            onClick={() => copyToClipboard(refLink)}
            className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/10 cursor-pointer hover:bg-surface-container-low transition-colors min-h-[48px]"
          >
            <input
              type="text"
              readOnly
              value={refLink}
              className="flex-1 bg-transparent text-sm text-on-surface outline-none px-2 font-mono cursor-pointer"
            />
          </div>
          <div 
            onClick={() => copyToClipboard(String(user?.telegram_id))}
            className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/10 cursor-pointer hover:bg-surface-container-low transition-colors min-h-[48px]"
          >
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider px-2 border-r border-outline-variant/10 mr-1">{t.promoLabel}</span>
            <input
              type="text"
              readOnly
              value={user?.telegram_id || ''}
              className="flex-1 bg-transparent font-bold text-primary outline-none px-2 font-mono text-[15px] cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-5 border-t border-outline-variant/10 pt-5 flex flex-col items-center pb-2">
          <div className="bg-white p-3 rounded-2xl w-fit mx-auto relative group shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(refLink)}`}
              alt="QR Code"
              width={180}
              height={180}
              className="rounded-xl block"
            />
          </div>
          <button
            onClick={handleSendQr}
            className="w-full bg-primary/20 text-primary border border-primary/30 py-3.5 rounded-xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">send_to_mobile</span>
            {t.getQrChat}
          </button>
        </div>
      </div>
    </div>
    );
  };
  const isManagerTab = ['stats', 'tariffs', 'faq'].includes(activeTab);

  return (
    <>
      {isStaff && isManagerTab ? renderAdminHeader() : renderUserHeader()}
      <main className="px-4 pt-2 space-y-8 max-w-2xl mx-auto pb-24">
        {isStaff && isManagerTab ? renderAdminContent() : renderUserContent()}
      </main>

      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-2 pb-6 pt-3 bg-[#131315]/80 backdrop-blur-2xl rounded-t-[1.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-white/5">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'catalog' ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'catalog' ? "\'FILL\' 1" : "\'FILL\' 0" }}>storefront</span>
          <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabCatalog}</span>
        </button>

        <button
          onClick={() => setActiveTab('referral')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'referral' ? 'text-secondary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'referral' ? "\'FILL\' 1" : "\'FILL\' 0" }}>group</span>
          <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabReferral}</span>
        </button>

        {isStaff && (
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'stats' ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'stats' ? "\'FILL\' 1" : "\'FILL\' 0" }}>bar_chart</span>
            <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabStats}</span>
          </button>
        )}

        {isAdmin && (
            <button
              onClick={() => setActiveTab('tariffs')}
              className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'tariffs' ? 'text-primary scale-110' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'tariffs' ? "\'FILL\' 1" : "\'FILL\' 0" }}>sell</span>
              <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabTariffs}</span>
            </button>
        )}

        <button
          onClick={() => setActiveTab('faq')}
          className={`flex flex-col items-center p-2 rounded-xl transition-all w-full max-w-[80px] ${activeTab === 'faq' ? (isStaff && isManagerTab ? 'text-primary scale-110' : 'text-secondary scale-110') : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: activeTab === 'faq' ? "\'FILL\' 1" : "\'FILL\' 0" }}>help</span>
          <span className="font-['Inter'] text-[9px] font-extrabold uppercase tracking-widest mt-1">{t.tabFaq}</span>
        </button>
      </nav>

      <WithdrawModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        balance={user?.balance || 0}
        lang={lang}
        telegramId={user?.telegram_id}
      />
    </>
  );
};

export default App;
