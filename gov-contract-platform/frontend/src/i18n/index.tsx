import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Translation dictionaries
export const translations = {
  th: {
    // Navigation
    'nav.dashboard': 'แดชบอร์ด',
    'nav.contracts': 'สัญญา',
    'nav.vendors': 'ผู้รับจ้าง',
    'nav.documents': 'เอกสาร',
    'nav.templates': 'แม่แบบสัญญา',
    'nav.settings': 'ตั้งค่า',
    
    // Settings Sidebar
    'settings.personal': 'ส่วนตัว',
    'settings.security': 'โปรไฟล์และความปลอดภัย',
    'settings.notifications': 'การแจ้งเตือน',
    'settings.general': 'การตั้งค่าทั่วไป',
    'settings.contracts': 'สัญญา',
    'settings.templates': 'แม่แบบสัญญา',
    'settings.ai_automation': 'AI & Automation',
    'settings.ai_models': 'AI Models',
    'settings.ai_features': 'AI Features',
    'settings.agents': 'Agents',
    'settings.knowledge_base': 'Knowledge Base (RAG)',
    'settings.graphrag': 'GraphRAG',
    'settings.system': 'ระบบ',
    'settings.ocr': 'OCR',
    'settings.server_api': 'เซิร์ฟเวอร์และ API',
    'settings.management': 'การจัดการ',
    'settings.org_structure': 'โครงสร้างองค์กร',
    'settings.user_management': 'จัดการผู้ใช้',
    
    // General Settings - Display
    'display.title': 'การแสดงผล',
    'display.subtitle': 'ธีม ภาษา และความหนาแน่นของหน้าจอ',
    'display.theme': 'ธีม',
    'display.theme.light': 'สว่าง',
    'display.theme.dark': 'มืด',
    'display.density': 'ความหนาแน่นการแสดงผล',
    'display.density.compact': 'กระทัดรัด',
    'display.density.compact_desc': 'ข้อมูลมากขึ้นในหน้าเดียว',
    'display.density.normal': 'ปกติ',
    'display.density.normal_desc': 'ค่าเริ่มต้น',
    'display.density.comfortable': 'โปร่ง',
    'display.density.comfortable_desc': 'อ่านง่ายขึ้น',
    'display.language': 'ภาษาอินเตอร์เฟซ',
    'display.language.th': 'ไทย',
    'display.language.en': 'English',
    'display.items_per_page': 'จำนวนรายการต่อหน้า',
    
    // General Settings - Date & Region
    'date.title': 'วันที่และภูมิภาค',
    'date.subtitle': 'รูปแบบวันที่ ระบบปฏิทิน และเขตเวลา',
    'date.calendar_system': 'ระบบปฏิทิน',
    'date.calendar.buddhist': 'พุทธศักราช',
    'date.calendar.buddhist_year': 'พ.ศ.',
    'date.calendar.gregorian': 'คริสต์ศักราช',
    'date.calendar.gregorian_year': 'ค.ศ.',
    'date.date_format': 'รูปแบบวันที่',
    'date.timezone': 'เขตเวลา',
    'date.timezone_bangkok': 'Asia/Bangkok (UTC+7) — เวลาประเทศไทยมาตรฐาน',
    
    // General Settings - Navigation
    'navigation.title': 'การนำทาง',
    'navigation.subtitle': 'หน้าแรกหลังเข้าสู่ระบบ',
    'navigation.default_page': 'หน้าเริ่มต้นหลังล็อกอิน',
    'navigation.dashboard': 'แดชบอร์ด',
    'navigation.contracts': 'สัญญา',
    'navigation.vendors': 'ผู้รับจ้าง',
    'navigation.documents': 'เอกสาร',
    
    // Common
    'common.save': 'บันทึก',
    'common.cancel': 'ยกเลิก',
    'common.edit': 'แก้ไข',
    'common.delete': 'ลบ',
    'common.create': 'สร้าง',
    'common.search': 'ค้นหา',
    'common.filter': 'กรอง',
    'common.loading': 'กำลังโหลด...',
    'common.success': 'สำเร็จ',
    'common.error': 'เกิดข้อผิดพลาด',
  },
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.contracts': 'Contracts',
    'nav.vendors': 'Vendors',
    'nav.documents': 'Documents',
    'nav.templates': 'Templates',
    'nav.settings': 'Settings',
    
    // Settings Sidebar
    'settings.personal': 'Personal',
    'settings.security': 'Profile & Security',
    'settings.notifications': 'Notifications',
    'settings.general': 'General Settings',
    'settings.contracts': 'Contracts',
    'settings.templates': 'Contract Templates',
    'settings.ai_automation': 'AI & Automation',
    'settings.ai_models': 'AI Models',
    'settings.ai_features': 'AI Features',
    'settings.agents': 'Agents',
    'settings.knowledge_base': 'Knowledge Base (RAG)',
    'settings.graphrag': 'GraphRAG',
    'settings.system': 'System',
    'settings.ocr': 'OCR',
    'settings.server_api': 'Server & API',
    'settings.management': 'Management',
    'settings.org_structure': 'Organization Structure',
    'settings.user_management': 'User Management',
    
    // General Settings - Display
    'display.title': 'Display',
    'display.subtitle': 'Theme, language, and display density',
    'display.theme': 'Theme',
    'display.theme.light': 'Light',
    'display.theme.dark': 'Dark',
    'display.density': 'Display Density',
    'display.density.compact': 'Compact',
    'display.density.compact_desc': 'More data on single page',
    'display.density.normal': 'Normal',
    'display.density.normal_desc': 'Default',
    'display.density.comfortable': 'Comfortable',
    'display.density.comfortable_desc': 'Easier to read',
    'display.language': 'Interface Language',
    'display.language.th': 'Thai',
    'display.language.en': 'English',
    'display.items_per_page': 'Items per page',
    
    // General Settings - Date & Region
    'date.title': 'Date & Region',
    'date.subtitle': 'Date format, calendar system, and timezone',
    'date.calendar_system': 'Calendar System',
    'date.calendar.buddhist': 'Buddhist Calendar',
    'date.calendar.buddhist_year': 'B.E.',
    'date.calendar.gregorian': 'Gregorian Calendar',
    'date.calendar.gregorian_year': 'A.D.',
    'date.date_format': 'Date Format',
    'date.timezone': 'Timezone',
    'date.timezone_bangkok': 'Asia/Bangkok (UTC+7) — Thailand Standard Time',
    
    // General Settings - Navigation
    'navigation.title': 'Navigation',
    'navigation.subtitle': 'Default page after login',
    'navigation.default_page': 'Default page after login',
    'navigation.dashboard': 'Dashboard',
    'navigation.contracts': 'Contracts',
    'navigation.vendors': 'Vendors',
    'navigation.documents': 'Documents',
    
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.create': 'Create',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.loading': 'Loading...',
    'common.success': 'Success',
    'common.error': 'Error',
  }
}

export type Language = 'th' | 'en'
export type Translations = typeof translations

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Load from localStorage on init
    const saved = localStorage.getItem('language') as Language
    return saved || 'th'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    document.documentElement.lang = lang
  }

  // Initialize document lang on mount
  useEffect(() => {
    document.documentElement.lang = language
  }, [])

  const t = (key: string): string => {
    const dict = translations[language] as Record<string, string>
    return dict[key] || key
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

// Hook for components that need both language preference and i18n
export const useLanguagePreference = () => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language
    return saved || 'th'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    document.documentElement.lang = lang
  }

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return { language, setLanguage }
}

export default translations
