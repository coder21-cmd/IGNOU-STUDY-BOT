import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

class IGNOUService {
  constructor() {
    this.baseUrls = {
      assignmentStatus: 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.asp',
      gradeCard: 'https://gradecard.ignou.ac.in/gradecard/',
      alternateAssignment: 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.ASP'
    };
    
    // Enhanced headers to mimic real browser
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
  }

  async checkAssignmentStatus(enrollmentNumber, programCode) {
    console.log(`🔍 Starting assignment status check for: ${enrollmentNumber}, Program: ${programCode}`);
    
    try {
      // Validate inputs first
      if (!enrollmentNumber || !programCode) {
        return { success: false, error: 'Enrollment number and program code are required' };
      }

      // Clean and validate inputs
      const cleanEnrollment = enrollmentNumber.toString().trim();
      const cleanProgram = programCode.toString().trim().toUpperCase();

      console.log(`📝 Cleaned inputs - Enrollment: ${cleanEnrollment}, Program: ${cleanProgram}`);

      // Validate enrollment number (9-10 digits)
      if (!/^\d{9,10}$/.test(cleanEnrollment)) {
        return { success: false, error: 'Invalid enrollment number format. Must be 9-10 digits.' };
      }

      // Validate program code
      if (!/^[A-Za-z]{2,10}$/.test(cleanProgram)) {
        return { success: false, error: 'Invalid program code format.' };
      }

      // Try multiple methods to get assignment data
      let result = await this.tryMethod1(cleanEnrollment, cleanProgram);
      
      if (!result.success) {
        console.log('🔄 Method 1 failed, trying Method 2...');
        result = await this.tryMethod2(cleanEnrollment, cleanProgram);
      }
      
      if (!result.success) {
        console.log('🔄 Method 2 failed, trying Method 3...');
        result = await this.tryMethod3(cleanEnrollment, cleanProgram);
      }

      return result;

    } catch (error) {
      console.error('❌ Error in checkAssignmentStatus:', error);
      return { 
        success: false, 
        error: 'Unable to fetch assignment status from IGNOU website. The website may be temporarily unavailable or your enrollment/program details may be incorrect.' 
      };
    }
  }

  async tryMethod1(enrollmentNumber, programCode) {
    try {
      console.log('🚀 Trying Method 1: Standard POST request');
      
      const formData = new URLSearchParams();
      formData.append('eno', enrollmentNumber);
      formData.append('prog', programCode);
      formData.append('Submit', 'Submit');

      console.log('📤 Sending request to:', this.baseUrls.assignmentStatus);
      console.log('📋 Form data:', formData.toString());

      const response = await fetch(this.baseUrls.assignmentStatus, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://isms.ignou.ac.in',
          'Referer': 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.asp'
        },
        body: formData.toString(),
        timeout: 30000,
        follow: 5
      });

      console.log(`📡 Response status: ${response.status}`);
      console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status}`);
        return { success: false, error: `Server error ${response.status}` };
      }

      const html = await response.text();
      console.log(`📄 Response length: ${html.length} characters`);
      
      // Log first 500 characters for debugging
      console.log('📄 Response preview:', html.substring(0, 500));

      return await this.parseAssignmentResponse(html, enrollmentNumber, programCode);

    } catch (error) {
      console.error('❌ Method 1 failed:', error);
      return { success: false, error: error.message };
    }
  }

  async tryMethod2(enrollmentNumber, programCode) {
    try {
      console.log('🚀 Trying Method 2: Alternative URL');
      
      const formData = new URLSearchParams();
      formData.append('eno', enrollmentNumber);
      formData.append('prog', programCode);
      formData.append('submit', 'Submit');

      const response = await fetch(this.baseUrls.alternateAssignment, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: `Server error ${response.status}` };
      }

      const html = await response.text();
      console.log(`📄 Method 2 response length: ${html.length} characters`);

      return await this.parseAssignmentResponse(html, enrollmentNumber, programCode);

    } catch (error) {
      console.error('❌ Method 2 failed:', error);
      return { success: false, error: error.message };
    }
  }

  async tryMethod3(enrollmentNumber, programCode) {
    try {
      console.log('🚀 Trying Method 3: GET request with query params');
      
      const url = `${this.baseUrls.assignmentStatus}?eno=${enrollmentNumber}&prog=${programCode}&Submit=Submit`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        timeout: 30000
      });

      if (!response.ok) {
        return { success: false, error: `Server error ${response.status}` };
      }

      const html = await response.text();
      console.log(`📄 Method 3 response length: ${html.length} characters`);

      return await this.parseAssignmentResponse(html, enrollmentNumber, programCode);

    } catch (error) {
      console.error('❌ Method 3 failed:', error);
      return { success: false, error: error.message };
    }
  }

  async parseAssignmentResponse(html, enrollmentNumber, programCode) {
    try {
      console.log('🔍 Starting to parse assignment response...');

      // Check for common error patterns first
      const errorCheck = this.checkForErrors(html);
      if (!errorCheck.success) {
        console.log('❌ Error detected in response:', errorCheck.error);
        return errorCheck;
      }

      // Check if enrollment number appears in response (good sign)
      if (!html.includes(enrollmentNumber)) {
        console.log('⚠️ Enrollment number not found in response');
        // Don't return error yet, continue parsing
      } else {
        console.log('✅ Enrollment number found in response');
      }

      // Parse assignments using multiple strategies
      const assignments = await this.extractAssignments(html, enrollmentNumber, programCode);

      console.log(`📊 Found ${assignments.length} assignments`);

      if (assignments.length === 0) {
        // Try to determine if it's a "no records" case vs parsing failure
        if (html.toLowerCase().includes('no record') || 
            html.toLowerCase().includes('not found') ||
            html.toLowerCase().includes('no data')) {
          return {
            success: false,
            error: 'No assignment records found. Please verify your enrollment number and programme code are correct.'
          };
        } else {
          // Parsing might have failed, but data might be there
          console.log('⚠️ No assignments parsed but no explicit "no records" message found');
          return {
            success: false,
            error: 'Unable to parse assignment data from IGNOU website. The website format may have changed or your details may be incorrect.'
          };
        }
      }

      return {
        success: true,
        data: {
          enrollmentNumber,
          programCode,
          assignments
        }
      };

    } catch (error) {
      console.error('❌ Error parsing assignment response:', error);
      return { success: false, error: 'Error parsing response from IGNOU website' };
    }
  }

  checkForErrors(html) {
    const lowerHtml = html.toLowerCase();
    
    console.log('🔍 Checking for error patterns in response...');
    
    // Enhanced error patterns
    const errorPatterns = [
      { pattern: /invalid.*enrollment/i, message: 'Invalid Enrollment Number' },
      { pattern: /enrollment.*invalid/i, message: 'Invalid Enrollment Number' },
      { pattern: /enrollment.*not.*found/i, message: 'Enrollment Number not found' },
      { pattern: /invalid.*programme/i, message: 'Invalid Programme Code' },
      { pattern: /programme.*invalid/i, message: 'Invalid Programme Code' },
      { pattern: /invalid.*program/i, message: 'Invalid Program Code' },
      { pattern: /program.*invalid/i, message: 'Invalid Program Code' },
      { pattern: /no.*record.*found/i, message: 'No assignment records found for the provided details' },
      { pattern: /record.*not.*found/i, message: 'No assignment records found for the provided details' },
      { pattern: /no.*data.*found/i, message: 'No assignment records found for the provided details' },
      { pattern: /data.*not.*available/i, message: 'Assignment data not available for the provided details' },
      { pattern: /error.*occurred/i, message: 'An error occurred on the IGNOU website' },
      { pattern: /server.*error/i, message: 'Server error on IGNOU website' },
      { pattern: /temporarily.*unavailable/i, message: 'IGNOU website is temporarily unavailable' }
    ];

    for (const { pattern, message } of errorPatterns) {
      if (pattern.test(html)) {
        console.log(`❌ Error pattern matched: ${pattern} -> ${message}`);
        return { success: false, error: message };
      }
    }

    console.log('✅ No error patterns found');
    return { success: true };
  }

  async extractAssignments(html, enrollmentNumber, programCode) {
    console.log('🔍 Extracting assignments using multiple strategies...');
    
    let assignments = [];
    
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Strategy 1: Look for tables with assignment data
      assignments = this.extractFromTables(document);
      console.log(`📊 Strategy 1 (tables): Found ${assignments.length} assignments`);

      // Strategy 2: If no assignments found, try text-based extraction
      if (assignments.length === 0) {
        assignments = this.extractFromText(html);
        console.log(`📊 Strategy 2 (text): Found ${assignments.length} assignments`);
      }

      // Strategy 3: Look for specific IGNOU course code patterns
      if (assignments.length === 0) {
        assignments = this.extractByCoursePatterns(html);
        console.log(`📊 Strategy 3 (patterns): Found ${assignments.length} assignments`);
      }

      // Strategy 4: Try to find any table with the enrollment number
      if (assignments.length === 0) {
        assignments = this.extractFromEnrollmentContext(document, enrollmentNumber);
        console.log(`📊 Strategy 4 (enrollment context): Found ${assignments.length} assignments`);
      }

    } catch (error) {
      console.error('❌ Error in extractAssignments:', error);
    }

    // Remove duplicates and validate
    const validAssignments = this.validateAndCleanAssignments(assignments);
    console.log(`✅ Final valid assignments: ${validAssignments.length}`);

    return validAssignments;
  }

  extractFromTables(document) {
    const assignments = [];
    
    try {
      const tables = document.querySelectorAll('table');
      console.log(`🔍 Found ${tables.length} tables to analyze`);
      
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const tableText = table.textContent.toLowerCase();
        
        // Check if this table contains assignment-related data
        if (this.isAssignmentTable(tableText)) {
          console.log(`📋 Table ${i + 1} appears to contain assignment data`);
          
          const rows = table.querySelectorAll('tr');
          console.log(`📋 Table ${i + 1} has ${rows.length} rows`);
          
          // Skip header row(s) and process data rows
          for (let j = 1; j < rows.length; j++) {
            const cells = rows[j].querySelectorAll('td, th');
            
            if (cells.length >= 3) {
              const assignment = this.extractAssignmentFromRow(cells, j);
              
              if (assignment && this.isValidAssignment(assignment)) {
                console.log(`✅ Valid assignment found in row ${j + 1}:`, assignment.courseCode);
                assignments.push(assignment);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error extracting from tables:', error);
    }
    
    return assignments;
  }

  isAssignmentTable(tableText) {
    const indicators = [
      'assignment',
      'course',
      'status',
      'session',
      'submission',
      'bcs', 'bca', 'mcs', 'mca',
      'eco', 'feg', 'meg',
      'practical', 'project',
      'marks', 'grade',
      'dec-', 'jun-', 'july', 'january'
    ];

    const hasIndicator = indicators.some(indicator => tableText.includes(indicator));
    
    if (hasIndicator) {
      console.log('📋 Table contains assignment indicators');
    }
    
    return hasIndicator;
  }

  extractAssignmentFromRow(cells, rowIndex) {
    try {
      const cellTexts = Array.from(cells).map(cell => this.cleanText(cell.textContent));
      console.log(`📋 Row ${rowIndex + 1} cells:`, cellTexts);
      
      let assignment = {
        courseCode: '',
        courseName: '',
        assignmentCode: 'Assignment',
        status: '',
        submissionDate: '',
        session: ''
      };

      // Look for course code pattern (most reliable identifier)
      const courseCodePattern = /^[A-Z]{2,6}\d{1,3}$/i;
      let courseCodeIndex = -1;
      
      for (let i = 0; i < cellTexts.length; i++) {
        if (courseCodePattern.test(cellTexts[i].trim())) {
          assignment.courseCode = cellTexts[i].trim().toUpperCase();
          assignment.courseName = assignment.courseCode;
          courseCodeIndex = i;
          console.log(`📝 Found course code: ${assignment.courseCode} at index ${i}`);
          break;
        }
      }

      if (courseCodeIndex === -1) {
        // No course code found, skip this row
        return null;
      }

      // Look for status (usually contains keywords like "check", "received", "processed")
      for (let i = 0; i < cellTexts.length; i++) {
        const text = cellTexts[i].toLowerCase();
        if (text.includes('check') || text.includes('received') || 
            text.includes('processed') || text.includes('submitted') ||
            text.includes('grade') || text.includes('detail')) {
          assignment.status = cellTexts[i];
          console.log(`📊 Found status: ${assignment.status} at index ${i}`);
          break;
        }
      }

      // Look for session pattern (Month-Year format)
      for (let i = 0; i < cellTexts.length; i++) {
        if (cellTexts[i].match(/\w+-\d{4}/)) {
          assignment.session = cellTexts[i];
          console.log(`📅 Found session: ${assignment.session} at index ${i}`);
          break;
        }
      }

      // Look for date pattern
      for (let i = 0; i < cellTexts.length; i++) {
        if (cellTexts[i].match(/\d{1,2}-\w{3}-\d{4}/) || cellTexts[i].match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          assignment.submissionDate = cellTexts[i];
          console.log(`📅 Found date: ${assignment.submissionDate} at index ${i}`);
          break;
        }
      }

      // If no status found, use a default
      if (!assignment.status && cellTexts.length > courseCodeIndex + 1) {
        assignment.status = cellTexts[courseCodeIndex + 1] || 'Status not available';
      }

      return assignment;

    } catch (error) {
      console.error(`❌ Error extracting assignment from row ${rowIndex + 1}:`, error);
      return null;
    }
  }

  extractFromText(html) {
    const assignments = [];
    
    try {
      console.log('🔍 Extracting assignments from raw text...');
      
      // Look for course code patterns in the entire HTML
      const courseCodeRegex = /([A-Z]{2,6}\d{1,3})/gi;
      const matches = html.match(courseCodeRegex);
      
      if (matches) {
        const uniqueCodes = [...new Set(matches.map(code => code.toUpperCase()))];
        console.log(`📝 Found course codes in text: ${uniqueCodes.join(', ')}`);
        
        for (const courseCode of uniqueCodes) {
          // Find context around each course code
          const assignment = this.findAssignmentContextInText(html, courseCode);
          if (assignment) {
            assignments.push(assignment);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error extracting from text:', error);
    }
    
    return assignments;
  }

  findAssignmentContextInText(html, courseCode) {
    try {
      // Find the position of the course code
      const index = html.toUpperCase().indexOf(courseCode);
      if (index === -1) return null;

      // Extract context around the course code (500 chars before and after)
      const start = Math.max(0, index - 500);
      const end = Math.min(html.length, index + 500);
      const context = html.substring(start, end);

      // Look for status keywords in the context
      const statusPatterns = [
        /check\s+grade\s+card\s+status\s+for\s+detail/i,
        /received\s+to\s+be\s+processed/i,
        /submitted/i,
        /processed/i,
        /evaluated/i
      ];

      let status = 'Status not available';
      for (const pattern of statusPatterns) {
        const match = context.match(pattern);
        if (match) {
          status = match[0];
          break;
        }
      }

      // Look for session pattern
      const sessionMatch = context.match(/(\w+-\d{4})/);
      const session = sessionMatch ? sessionMatch[1] : '';

      return {
        courseCode: courseCode,
        courseName: courseCode,
        assignmentCode: 'Assignment',
        status: status,
        submissionDate: '',
        session: session
      };

    } catch (error) {
      console.error('❌ Error finding assignment context:', error);
      return null;
    }
  }

  extractByCoursePatterns(html) {
    const assignments = [];
    
    try {
      console.log('🔍 Extracting by IGNOU course patterns...');
      
      // Common IGNOU course patterns
      const ignouPatterns = [
        /BCS\d{2,3}/gi,  // BCS011, BCS012, etc.
        /BCSL\d{2,3}/gi, // BCSL13, BCSL21, etc.
        /MCS\d{2,3}/gi,  // MCS courses
        /ECO\d{2,3}/gi,  // ECO001, ECO002, etc.
        /FEG\d{2,3}/gi,  // FEG02, etc.
        /MEG\d{2,3}/gi,  // MEG courses
        /EHI\d{2,3}/gi,  // History courses
        /EPS\d{2,3}/gi   // Political Science courses
      ];

      for (const pattern of ignouPatterns) {
        const matches = html.match(pattern);
        if (matches) {
          const uniqueCodes = [...new Set(matches.map(code => code.toUpperCase()))];
          console.log(`📝 Found ${pattern} courses: ${uniqueCodes.join(', ')}`);
          
          for (const courseCode of uniqueCodes) {
            const assignment = this.findAssignmentContextInText(html, courseCode);
            if (assignment) {
              assignments.push(assignment);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error extracting by course patterns:', error);
    }
    
    return assignments;
  }

  extractFromEnrollmentContext(document, enrollmentNumber) {
    const assignments = [];
    
    try {
      console.log(`🔍 Looking for tables containing enrollment ${enrollmentNumber}...`);
      
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        if (table.textContent.includes(enrollmentNumber)) {
          console.log('📋 Found table containing enrollment number');
          
          const rows = table.querySelectorAll('tr');
          
          for (const row of rows) {
            const rowText = row.textContent;
            const courseMatch = rowText.match(/([A-Z]{2,6}\d{1,3})/);
            
            if (courseMatch) {
              const courseCode = courseMatch[1];
              
              // Extract status from the same row
              let status = 'Status not available';
              const cells = row.querySelectorAll('td, th');
              
              for (const cell of cells) {
                const cellText = cell.textContent.toLowerCase();
                if (cellText.includes('check') || cellText.includes('received') || 
                    cellText.includes('processed') || cellText.includes('submitted')) {
                  status = this.cleanText(cell.textContent);
                  break;
                }
              }
              
              assignments.push({
                courseCode: courseCode,
                courseName: courseCode,
                assignmentCode: 'Assignment',
                status: status,
                submissionDate: '',
                session: this.extractSession(rowText)
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error extracting from enrollment context:', error);
    }
    
    return assignments;
  }

  isValidAssignment(assignment) {
    const isValid = (
      assignment &&
      assignment.courseCode &&
      assignment.courseCode.length >= 3 &&
      /^[A-Z]{2,6}\d{1,3}$/i.test(assignment.courseCode) &&
      assignment.status &&
      assignment.status.length > 2
    );
    
    if (!isValid) {
      console.log('❌ Invalid assignment:', assignment);
    }
    
    return isValid;
  }

  validateAndCleanAssignments(assignments) {
    const validAssignments = [];
    const seen = new Set();
    
    for (const assignment of assignments) {
      if (this.isValidAssignment(assignment)) {
        const key = `${assignment.courseCode}-${assignment.status}`;
        
        if (!seen.has(key)) {
          seen.add(key);
          validAssignments.push({
            courseCode: assignment.courseCode,
            courseName: assignment.courseName || assignment.courseCode,
            assignmentCode: assignment.assignmentCode || 'Assignment',
            status: assignment.status,
            submissionDate: assignment.submissionDate || 'N/A',
            session: assignment.session || 'N/A'
          });
        }
      }
    }
    
    return validAssignments;
  }

  extractSession(text) {
    const sessionMatch = text.match(/(\w+-\d{4})/);
    return sessionMatch ? sessionMatch[1] : '';
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, ' ').trim();
  }

  // Grade Card and Assignment Marks methods (simplified for now)
  async getGradeCard(enrollmentNumber, programCode) {
    return { 
      success: false, 
      error: 'Grade card service is temporarily unavailable. Please try again later.' 
    };
  }

  formatAssignmentStatus(data) {
    let message = `📋 Assignment Status Report\n\n`;
    message += `👤 Enrollment: ${data.enrollmentNumber}\n`;
    message += `🎓 Programme: ${data.programCode}\n\n`;
    
    if (data.assignments.length === 0) {
      message += `❌ No assignment records found.\n`;
      return message;
    }
    
    message += `📚 Assignment Details (${data.assignments.length} found):\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    data.assignments.forEach((assignment, index) => {
      message += `\n${index + 1}. ${assignment.courseCode}\n`;
      if (assignment.courseName && assignment.courseName !== assignment.courseCode) {
        message += `   📖 ${assignment.courseName}\n`;
      }
      if (assignment.session && assignment.session !== 'N/A') {
        message += `   📅 Session: ${assignment.session}\n`;
      }
      message += `   📝 Assignment: ${assignment.assignmentCode}\n`;
      message += `   ✅ Status: ${assignment.status}\n`;
      if (assignment.submissionDate && assignment.submissionDate !== 'N/A') {
        message += `   📅 Date: ${assignment.submissionDate}\n`;
      }
    });
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Total Assignments: ${data.assignments.length}`;
    
    return message;
  }

  formatGradeCard(data) {
    return 'Grade card formatting is temporarily unavailable.';
  }

  formatAssignmentMarks(data) {
    return 'Assignment marks formatting is temporarily unavailable.';
  }
}

export default IGNOUService;
