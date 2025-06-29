export const BotStates = {
  BROWSING: 'browsing',
  SEARCHING: 'searching',
  CONFIRMING_PURCHASE: 'confirming_purchase',
  WAITING_SCREENSHOT: 'waiting_screenshot',
  WAITING_APPROVAL: 'waiting_approval'
};

export const AdminStates = {
  MAIN: 'admin_main',
  MANAGING_CATEGORIES: 'managing_categories',
  MANAGING_PRODUCTS: 'managing_products',
  UPLOADING_FILES: 'uploading_files',
  CREATING_CATEGORY: 'creating_category',
  CREATING_PRODUCT: 'creating_product',
  EDITING_CATEGORY: 'editing_category',
  EDITING_PRODUCT: 'editing_product',
  MANAGING_MATERIALS: 'managing_materials',
  ADDING_PYQ: 'adding_pyq',
  ADDING_ASSIGNMENT: 'adding_assignment',
  ADDING_NOTES: 'adding_notes',
  ADDING_BOOKS: 'adding_books'
};

export const IGNOUStates = {
  WAITING_ENROLLMENT_ASSIGNMENT: 'waiting_enrollment_assignment',
  WAITING_ENROLLMENT_GRADE: 'waiting_enrollment_grade',
  WAITING_ENROLLMENT_MARKS: 'waiting_enrollment_marks',
  WAITING_PROGRAM_CODE: 'waiting_program_code',
  PROCESSING_REQUEST: 'processing_request'
};

export const MaterialStates = {
  SELECTING_PROGRAM: 'selecting_program',
  SELECTING_MATERIAL_TYPE: 'selecting_material_type',
  SELECTING_SEMESTER: 'selecting_semester',
  SELECTING_SUBJECT: 'selecting_subject',
  SELECTING_SESSION: 'selecting_session',
  DOWNLOADING: 'downloading'
};

export const OrderStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

export const FileTypes = {
  DOCUMENT: 'document',
  VIDEO: 'video',
  PHOTO: 'photo',
  AUDIO: 'audio',
  ARCHIVE: 'archive'
};

export const PaymentMethods = {
  UPI: 'upi',
  BANK_TRANSFER: 'bank_transfer',
  WALLET: 'wallet'
};

export const UserRoles = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

export const MaterialTypes = {
  PYQ: 'pyq',
  ASSIGNMENT: 'assignment',
  NOTES: 'notes',
  BOOKS: 'books'
};

export const IGNOUPrograms = {
  BCA: 'Bachelor of Computer Applications',
  MCA: 'Master of Computer Applications',
  BA: 'Bachelor of Arts',
  MA: 'Master of Arts',
  BCOM: 'Bachelor of Commerce',
  MCOM: 'Master of Commerce',
  BSC: 'Bachelor of Science',
  MSC: 'Master of Science',
  BED: 'Bachelor of Education',
  MED: 'Master of Education'
};

export const MAX_CATEGORY_DEPTH = 5;
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
export const ITEMS_PER_PAGE = 10;

export const Messages = {
  WELCOME: '🎓 Welcome to IGNOU STUDY BOT!\n\nCheck Ignou Services for:\n\nassignment status, assignment, grade card marks\n\nCheck Ignou Materials for:\n\nPyqs, assignment, study notes, ignou digital books\n\nChoose an option below to get started:',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  UNAUTHORIZED_ADMIN: 'Sorry, you do not have administrator privileges to access this content.',
  ERROR_GENERIC: 'Something went wrong. Please try again.',
  ORDER_CREATED: 'Your order has been created successfully.',
  PAYMENT_PENDING: 'Your payment is being verified.',
  PAYMENT_APPROVED: 'Your payment has been approved!',
  PAYMENT_REJECTED: 'Your payment could not be verified.',
  FILES_SENT: 'All files have been sent successfully!',
  NO_PRODUCTS: 'No products available at the moment.',
  NO_CATEGORIES: 'No categories available at the moment.',
  PRODUCT_NOT_FOUND: 'Product not found.',
  CATEGORY_NOT_FOUND: 'Category not found.',
  ORDER_NOT_FOUND: 'Order not found.',
  ACCESS_DENIED: 'Access denied. This feature requires administrator privileges.',
  ADMIN_ONLY_FEATURE: 'This feature is available only to administrators.',
  INSUFFICIENT_PERMISSIONS: 'You do not have sufficient permissions to perform this action.'
};

export const Emojis = {
  CATEGORY: '📁',
  PRODUCT: '📖',
  PRICE: '💰',
  ORDER: '📋',
  USER: '👤',
  ADMIN: '⚙️',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  SEARCH: '🔍',
  DOWNLOAD: '📥',
  UPLOAD: '📤',
  FILE: '📎',
  PAYMENT: '💳',
  STATS: '📊',
  BACK: '⬅️',
  HOME: '🏠',
  NEW: '🆕',
  EDIT: '✏️',
  DELETE: '🗑️',
  LOCK: '🔒',
  SHIELD: '🛡️',
  IGNOU: '🎓',
  ASSIGNMENT: '📋',
  GRADE: '🎓',
  MARKS: '📊',
  PYQ: '📝',
  NOTES: '📖',
  BOOKS: '📚',
  MATERIALS: '📚'
};

// Admin Access Control Messages
export const AdminMessages = {
  ACCESS_DENIED: {
    title: '🔒 Access Restricted',
    message: 'Sorry, you do not have administrator privileges to access this content.',
    description: 'This section is reserved for authorized administrators only. If you believe you should have access, please contact the system administrator.',
    action: 'Return to Main Menu'
  },
  FEATURE_RESTRICTED: {
    title: '🛡️ Administrator Feature',
    message: 'This feature requires administrator privileges.',
    description: 'The requested functionality is available only to system administrators for security and management purposes.',
    action: 'Go Back'
  },
  INSUFFICIENT_PERMISSIONS: {
    title: '⚠️ Insufficient Permissions',
    message: 'You do not have sufficient permissions to perform this action.',
    description: 'Your current user level does not allow access to this administrative function.',
    action: 'Return to Previous Menu'
  }
};

// IGNOU Service Messages
export const IGNOUMessages = {
  WELCOME: {
    title: '🎓 IGNOU Services',
    message: 'Access your IGNOU academic information quickly and easily.',
    services: [
      '📋 Assignment Status - Check submission status',
      '🎓 Grade Card - Complete semester results with SGPA',
      '📊 Assignment Marks - Semester-wise assignment marks with percentages'
    ]
  },
  ENROLLMENT_PROMPT: {
    title: 'Enter Enrollment Number',
    message: 'Please enter your IGNOU enrollment number (9 or 10 digits):',
    example: 'Example: 123456789 or 1234567890',
    validation: 'Make sure to enter the correct enrollment number.'
  },
  PROGRAM_PROMPT: {
    title: 'Enter Programme Code',
    message: 'Please enter your programme code:',
    examples: [
      'BCA - Bachelor of Computer Applications',
      'MCA - Master of Computer Applications',
      'BA - Bachelor of Arts',
      'MA - Master of Arts',
      'BCOM - Bachelor of Commerce',
      'MCOM - Master of Commerce'
    ]
  },
  PROCESSING: {
    title: 'Processing Request',
    message: 'Fetching your academic information...',
    note: 'Please wait, this may take a few moments.'
  },
  ERROR: {
    INVALID_ENROLLMENT: 'Invalid enrollment number. Please enter a 9 or 10 digit enrollment number.',
    INVALID_PROGRAM: 'Invalid programme code. Please enter a valid programme code (e.g., BCA, MCA, BA).',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later.',
    DATA_NOT_FOUND: 'No data found for the provided enrollment number and programme code.',
    NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.'
  }
};

// Material Management Messages
export const MaterialMessages = {
  PYQ: {
    TITLE: '📝 Previous Year Questions',
    DESCRIPTION: 'Access previous year question papers semester-wise',
    NO_SUBJECTS: 'No subjects available for this semester',
    NO_SESSIONS: 'No question papers available for this subject',
    DOWNLOADING: 'Downloading your PYQ file...',
    SUCCESS: 'PYQ file sent successfully!'
  },
  ASSIGNMENT: {
    TITLE: '📋 Current Session Assignments',
    DESCRIPTION: 'Access current session assignments semester-wise',
    NO_ASSIGNMENTS: 'No assignments available for this semester',
    DOWNLOADING: 'Downloading your assignment file...',
    SUCCESS: 'Assignment file sent successfully!'
  },
  NOTES: {
    TITLE: '📖 Study Notes',
    DESCRIPTION: 'Comprehensive study materials and notes',
    NO_CATEGORIES: 'No study note categories available',
    DOWNLOADING: 'Downloading your study notes...',
    SUCCESS: 'Study notes sent successfully!'
  },
  BOOKS: {
    TITLE: '📚 IGNOU Digital Books',
    DESCRIPTION: 'Official IGNOU digital books and materials',
    NO_BOOKS: 'No digital books available',
    DOWNLOADING: 'Downloading your digital book...',
    SUCCESS: 'Digital book sent successfully!'
  }
};
