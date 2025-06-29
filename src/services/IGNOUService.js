import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

class IGNOUService {
  constructor() {
    this.baseUrls = {
      assignmentStatus: 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.asp',
      gradeCard: 'https://gradecard.ignou.ac.in/gradecard/',
      alternateAssignment: 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.ASP'
    };
    
    // Common headers for all requests
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };
  }

  async checkAssignmentStatus(enrollmentNumber, programCode) {
    try {
      console.log(`Checking assignment status for: ${enrollmentNumber}, Program: ${programCode}`);
      
      // Validate inputs
      if (!enrollmentNumber || !programCode) {
        return { success: false, error: 'Enrollment number and program code are required' };
      }

      // Clean inputs
      const cleanEnrollment = enrollmentNumber.toString().trim();
      const cleanProgram = programCode.toString().trim().toUpperCase();

      // Validate enrollment number (9-10 digits)
      if (!/^\d{9,10}$/.test(cleanEnrollment)) {
        return { success: false, error: 'Invalid enrollment number format. Must be 9-10 digits.' };
      }

      // Create form data exactly as the website expects
      const formData = new URLSearchParams();
      formData.append('eno', cleanEnrollment);
      formData.append('prog', cleanProgram);
      formData.append('Submit', 'Submit');

      console.log('Sending request with data:', { eno: cleanEnrollment, prog: cleanProgram });

      const response = await fetch(this.baseUrls.assignmentStatus, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://isms.ignou.ac.in',
          'Referer': 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.asp'
        },
        body: formData.toString(),
        timeout: 30000
      });

      if (!response.ok) {
        console.error(`HTTP Error: ${response.status}`);
        return { 
          success: false, 
          error: `Server returned error ${response.status}. Please try again later.` 
        };
      }

      const html = await response.text();
      console.log('Response length:', html.length);

      // Check for error messages in the response
      const errorCheck = this.checkForErrors(html);
      if (!errorCheck.success) {
        return errorCheck;
      }

      // Parse assignment data from HTML
      const assignments = await this.parseAssignmentData(html, cleanEnrollment, cleanProgram);

      if (assignments.length === 0) {
        return {
          success: false,
          error: 'No assignment records found. Please verify your enrollment number and programme code are correct.'
        };
      }

      return {
        success: true,
        data: {
          enrollmentNumber: cleanEnrollment,
          programCode: cleanProgram,
          assignments: assignments
        }
      };

    } catch (error) {
      console.error('Error in checkAssignmentStatus:', error);
      
      if (error.code === 'ENOTFOUND') {
        return { success: false, error: 'Unable to connect to IGNOU website. Please check your internet connection.' };
      }
      
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timed out. Please try again.' };
      }
      
      return { 
        success: false, 
        error: 'Unable to fetch assignment status from IGNOU website. The website may be temporarily unavailable or your enrollment/program details may be incorrect.' 
      };
    }
  }

  checkForErrors(html) {
    const lowerHtml = html.toLowerCase();
    
    // Check for various error patterns
    const errorPatterns = [
      { pattern: /invalid.*enrollment/i, message: 'Invalid Enrollment Number' },
      { pattern: /enrollment.*invalid/i, message: 'Invalid Enrollment Number' },
      { pattern: /invalid.*programme/i, message: 'Invalid Programme Code' },
      { pattern: /programme.*invalid/i, message: 'Invalid Programme Code' },
      { pattern: /invalid.*program/i, message: 'Invalid Program Code' },
      { pattern: /program.*invalid/i, message: 'Invalid Program Code' },
      { pattern: /no.*record.*found/i, message: 'No assignment records found for the provided details' },
      { pattern: /record.*not.*found/i, message: 'No assignment records found for the provided details' },
      { pattern: /no.*data.*found/i, message: 'No assignment records found for the provided details' },
      { pattern: /data.*not.*available/i, message: 'Assignment data not available for the provided details' }
    ];

    for (const { pattern, message } of errorPatterns) {
      if (pattern.test(html)) {
        return { success: false, error: message };
      }
    }

    return { success: true };
  }

  async parseAssignmentData(html, enrollmentNumber, programCode) {
    const assignments = [];
    
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Method 1: Look for the standard assignment table
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        const tableText = table.textContent.toLowerCase();
        
        // Check if this table contains assignment data
        if (this.isAssignmentTable(tableText)) {
          console.log('Found potential assignment table');
          
          const rows = table.querySelectorAll('tr');
          
          // Skip header row and process data rows
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td, th');
            
            if (cells.length >= 4) {
              const assignment = this.extractAssignmentFromRow(cells);
              
              if (assignment && this.isValidAssignment(assignment)) {
                assignments.push(assignment);
              }
            }
          }
        }
      }

      // Method 2: If no assignments found, try alternative parsing
      if (assignments.length === 0) {
        console.log('No assignments found in tables, trying alternative parsing');
        const alternativeAssignments = this.parseAssignmentDataAlternative(html);
        assignments.push(...alternativeAssignments);
      }

      // Method 3: Look for enrollment confirmation and parse nearby data
      if (assignments.length === 0) {
        console.log('Trying enrollment-based parsing');
        const enrollmentBasedAssignments = this.parseByEnrollmentConfirmation(html, enrollmentNumber);
        assignments.push(...enrollmentBasedAssignments);
      }

    } catch (error) {
      console.error('Error parsing assignment data:', error);
    }

    // Remove duplicates
    const uniqueAssignments = this.removeDuplicateAssignments(assignments);
    
    console.log(`Found ${uniqueAssignments.length} unique assignments`);
    return uniqueAssignments;
  }

  isAssignmentTable(tableText) {
    const indicators = [
      'assignment',
      'course',
      'status',
      'session',
      'submission',
      'bcs',
      'eco',
      'feg',
      'mcs',
      'practical',
      'project'
    ];

    return indicators.some(indicator => tableText.includes(indicator));
  }

  extractAssignmentFromRow(cells) {
    try {
      const cellTexts = Array.from(cells).map(cell => this.cleanText(cell.textContent));
      
      // Common patterns for assignment data
      let assignment = {
        courseCode: '',
        courseName: '',
        assignmentCode: '',
        status: '',
        submissionDate: '',
        session: ''
      };

      // Pattern 1: Name, Course, Session, Status, Date
      if (cellTexts.length >= 4) {
        assignment.assignmentCode = cellTexts[0] || 'Assignment';
        assignment.courseCode = cellTexts[1] || '';
        assignment.session = cellTexts[2] || '';
        assignment.status = cellTexts[3] || '';
        assignment.submissionDate = cellTexts[4] || '';
      }

      // Validate course code pattern
      const courseCodePattern = /^[A-Z]{2,6}\d{1,3}$/i;
      
      // Find the cell that looks like a course code
      for (let i = 0; i < cellTexts.length; i++) {
        if (courseCodePattern.test(cellTexts[i])) {
          assignment.courseCode = cellTexts[i];
          assignment.courseName = cellTexts[i];
          
          // Look for status in remaining cells
          for (let j = i + 1; j < cellTexts.length; j++) {
            const text = cellTexts[j].toLowerCase();
            if (text.includes('check') || text.includes('received') || text.includes('processed') || text.includes('submitted')) {
              assignment.status = cellTexts[j];
              break;
            }
          }
          
          // Look for session pattern (Month-Year)
          for (let j = 0; j < cellTexts.length; j++) {
            if (cellTexts[j].match(/\w+-\d{4}/)) {
              assignment.session = cellTexts[j];
              break;
            }
          }
          
          break;
        }
      }

      return assignment;
    } catch (error) {
      console.error('Error extracting assignment from row:', error);
      return null;
    }
  }

  isValidAssignment(assignment) {
    return (
      assignment &&
      assignment.courseCode &&
      assignment.courseCode.length > 2 &&
      /^[A-Z]{2,6}\d{1,3}$/i.test(assignment.courseCode) &&
      assignment.status &&
      assignment.status.length > 2
    );
  }

  parseAssignmentDataAlternative(html) {
    const assignments = [];
    
    try {
      // Look for course codes in the entire HTML
      const courseCodeRegex = /([A-Z]{2,6}\d{1,3})/gi;
      const matches = html.match(courseCodeRegex);
      
      if (matches) {
        const uniqueCodes = [...new Set(matches.map(code => code.toUpperCase()))];
        console.log('Found course codes:', uniqueCodes);
        
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        for (const courseCode of uniqueCodes) {
          // Find context around each course code
          const assignment = this.findAssignmentContext(document, courseCode);
          if (assignment) {
            assignments.push(assignment);
          }
        }
      }
    } catch (error) {
      console.error('Error in alternative parsing:', error);
    }
    
    return assignments;
  }

  findAssignmentContext(document, courseCode) {
    try {
      // Find all elements containing the course code
      const walker = document.createTreeWalker(
        document.body,
        4, // NodeFilter.SHOW_TEXT
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes(courseCode)) {
          // Found the course code, now look for status information nearby
          let element = node.parentElement;
          let attempts = 0;
          
          while (element && attempts < 5) {
            const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
            
            for (const sibling of siblings) {
              const text = sibling.textContent.toLowerCase();
              
              if (text.includes('check grade') || 
                  text.includes('received') || 
                  text.includes('processed') ||
                  text.includes('submitted')) {
                
                return {
                  courseCode: courseCode,
                  courseName: courseCode,
                  assignmentCode: 'Assignment',
                  status: this.cleanText(sibling.textContent),
                  submissionDate: '',
                  session: this.extractSession(element.parentElement.textContent)
                };
              }
            }
            
            element = element.parentElement;
            attempts++;
          }
          
          break;
        }
      }
    } catch (error) {
      console.error('Error finding assignment context:', error);
    }
    
    return null;
  }

  parseByEnrollmentConfirmation(html, enrollmentNumber) {
    const assignments = [];
    
    try {
      if (html.includes(enrollmentNumber)) {
        console.log('Found enrollment number in response, parsing nearby data');
        
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        // Look for tables after enrollment confirmation
        const tables = document.querySelectorAll('table');
        
        for (const table of tables) {
          const tableText = table.textContent;
          
          // If table contains course codes, parse it
          if (tableText.match(/[A-Z]{2,6}\d{1,3}/)) {
            const rows = table.querySelectorAll('tr');
            
            for (const row of rows) {
              const cells = row.querySelectorAll('td, th');
              const rowText = row.textContent;
              
              // Look for course code pattern
              const courseMatch = rowText.match(/([A-Z]{2,6}\d{1,3})/);
              
              if (courseMatch) {
                const courseCode = courseMatch[1];
                
                // Extract status from the same row
                let status = 'Unknown';
                for (const cell of cells) {
                  const cellText = cell.textContent.toLowerCase();
                  if (cellText.includes('check') || cellText.includes('received') || cellText.includes('processed')) {
                    status = this.cleanText(cell.textContent);
                    break;
                  }
                }
                
                if (status !== 'Unknown') {
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
        }
      }
    } catch (error) {
      console.error('Error in enrollment-based parsing:', error);
    }
    
    return assignments;
  }

  extractSession(text) {
    const sessionMatch = text.match(/(\w+-\d{4})/);
    return sessionMatch ? sessionMatch[1] : '';
  }

  removeDuplicateAssignments(assignments) {
    const seen = new Set();
    return assignments.filter(assignment => {
      const key = `${assignment.courseCode}-${assignment.status}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/[\r\n\t]/g, ' ').trim();
  }

  async getGradeCard(enrollmentNumber, programCode) {
    try {
      console.log(`Fetching grade card for: ${enrollmentNumber}, Program: ${programCode}`);
      
      const cleanEnrollment = enrollmentNumber.toString().trim();
      const cleanProgram = programCode.toString().trim().toUpperCase();

      const formData = new URLSearchParams();
      formData.append('eno', cleanEnrollment);
      formData.append('prog', cleanProgram);
      formData.append('submit', 'Submit');

      const response = await fetch(this.baseUrls.gradeCard, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://gradecard.ignou.ac.in',
          'Referer': 'https://gradecard.ignou.ac.in/gradecard/'
        },
        body: formData.toString(),
        timeout: 30000
      });

      if (!response.ok) {
        return { 
          success: false, 
          error: `Server returned error ${response.status}. Please try again later.` 
        };
      }

      const html = await response.text();
      
      // Check for errors
      const errorCheck = this.checkForErrors(html);
      if (!errorCheck.success) {
        return errorCheck;
      }

      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract data
      const studentInfo = this.extractStudentInfo(document);
      const semesterResults = this.extractSemesterResults(document);
      const assignmentMarks = this.extractAssignmentMarks(document);

      // Check if we got meaningful data
      if (Object.keys(studentInfo).length === 0 && 
          semesterResults.length === 0 && 
          Object.keys(assignmentMarks).length === 0) {
        return { 
          success: false, 
          error: 'No grade card data found. Please verify your enrollment number and programme code are correct.' 
        };
      }

      return {
        success: true,
        data: {
          enrollmentNumber: cleanEnrollment,
          programCode: cleanProgram,
          studentInfo,
          semesterResults,
          assignmentMarks
        }
      };

    } catch (error) {
      console.error('Error fetching grade card:', error);
      return { 
        success: false, 
        error: 'Unable to fetch grade card from IGNOU website. Please try again later.' 
      };
    }
  }

  extractStudentInfo(document) {
    const info = {};
    
    try {
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          if (cells.length >= 2) {
            const label = this.cleanText(cells[0].textContent).toLowerCase();
            const value = this.cleanText(cells[1].textContent);
            
            if (label.includes('name') && !label.includes('programme')) {
              info.name = value;
            } else if (label.includes('programme') || label.includes('program')) {
              info.programme = value;
            } else if (label.includes('enrollment')) {
              info.enrollment = value;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error extracting student info:', error);
    }
    
    return info;
  }

  extractSemesterResults(document) {
    const semesters = [];
    
    try {
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) continue;
        
        const headerRow = rows[0];
        const headerText = headerRow.textContent.toLowerCase();
        
        if (headerText.includes('course') && (headerText.includes('grade') || headerText.includes('marks'))) {
          const semesterData = {
            courses: [],
            totalCredits: 0,
            totalGradePoints: 0,
            sgpa: 0
          };
          
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td, th');
            if (cells.length >= 3) {
              const course = {
                courseCode: this.cleanText(cells[0]?.textContent || ''),
                courseName: this.cleanText(cells[1]?.textContent || ''),
                credits: this.parseNumber(cells[2]?.textContent) || 0,
                grade: this.cleanText(cells[3]?.textContent || ''),
                gradePoints: this.parseNumber(cells[4]?.textContent) || 0
              };
              
              if (course.courseCode && course.courseCode.length > 1) {
                semesterData.courses.push(course);
                semesterData.totalCredits += course.credits;
                semesterData.totalGradePoints += course.gradePoints;
              }
            }
          }
          
          if (semesterData.totalCredits > 0) {
            semesterData.sgpa = (semesterData.totalGradePoints / semesterData.totalCredits).toFixed(2);
          }
          
          if (semesterData.courses.length > 0) {
            semesters.push(semesterData);
          }
        }
      }
    } catch (error) {
      console.error('Error extracting semester results:', error);
    }
    
    return semesters;
  }

  extractAssignmentMarks(document) {
    const assignmentsBySemester = {};
    
    try {
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        if (rows.length < 2) continue;
        
        const headerRow = rows[0];
        const headerText = headerRow.textContent.toLowerCase();
        
        if (headerText.includes('assignment') && headerText.includes('marks')) {
          
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td, th');
            if (cells.length >= 3) {
              const courseCode = this.cleanText(cells[0]?.textContent || '');
              const assignmentMarks = this.parseNumber(cells[1]?.textContent) || 0;
              const totalMarks = this.parseNumber(cells[2]?.textContent) || 0;
              
              if (courseCode) {
                const semester = this.determineSemester(courseCode);
                
                if (!assignmentsBySemester[semester]) {
                  assignmentsBySemester[semester] = [];
                }
                
                assignmentsBySemester[semester].push({
                  courseCode,
                  assignmentMarks,
                  totalMarks,
                  percentage: totalMarks ? ((assignmentMarks / totalMarks) * 100).toFixed(2) : '0'
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error extracting assignment marks:', error);
    }
    
    return assignmentsBySemester;
  }

  determineSemester(courseCode) {
    const code = courseCode.toUpperCase();
    
    // IGNOU semester patterns
    if (code.includes('1ST') || code.includes('I')) return 'Semester 1';
    if (code.includes('2ND') || code.includes('II')) return 'Semester 2';
    if (code.includes('3RD') || code.includes('III')) return 'Semester 3';
    if (code.includes('4TH') || code.includes('IV')) return 'Semester 4';
    if (code.includes('5TH') || code.includes('V')) return 'Semester 5';
    if (code.includes('6TH') || code.includes('VI')) return 'Semester 6';
    
    // Number-based patterns
    if (code.match(/\d1$/) || code.includes('01')) return 'Semester 1';
    if (code.match(/\d2$/) || code.includes('02')) return 'Semester 2';
    if (code.match(/\d3$/) || code.includes('03')) return 'Semester 3';
    if (code.match(/\d4$/) || code.includes('04')) return 'Semester 4';
    if (code.match(/\d5$/) || code.includes('05')) return 'Semester 5';
    if (code.match(/\d6$/) || code.includes('06')) return 'Semester 6';
    
    return 'Other';
  }

  parseNumber(text) {
    if (!text) return 0;
    const cleaned = text.replace(/[^\d.]/g, '');
    return parseFloat(cleaned) || 0;
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
      if (assignment.session && assignment.session !== 'N/A') {
        message += `   📅 Session: ${assignment.session}\n`;
      }
      message += `   📝 Assignment: ${assignment.assignmentCode}\n`;
      message += `   ✅ Status: ${assignment.status}\n`;
      if (assignment.submissionDate && assignment.submissionDate !== 'N/A') {
        message += `   📅 Date: ${assignment.submissionDate}\n`;
      }
    });
    
    return message;
  }

  formatGradeCard(data) {
    let message = `🎓 Grade Card Report\n\n`;
    message += `👤 Enrollment: ${data.enrollmentNumber}\n`;
    message += `🎓 Programme: ${data.programCode}\n`;
    
    if (data.studentInfo.name) {
      message += `📝 Name: ${data.studentInfo.name}\n`;
    }
    if (data.studentInfo.programme) {
      message += `📚 Programme: ${data.studentInfo.programme}\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (data.semesterResults.length === 0) {
      message += `❌ No semester results found.\n`;
      return message;
    }
    
    let totalCredits = 0;
    let totalGradePoints = 0;
    
    data.semesterResults.forEach((semester, index) => {
      message += `\n📊 Semester ${index + 1} Results:\n`;
      message += `▫️ Credits: ${semester.totalCredits} | SGPA: ${semester.sgpa}\n\n`;
      
      semester.courses.forEach(course => {
        message += `📖 ${course.courseCode}`;
        if (course.courseName && course.courseName !== course.courseCode) {
          message += ` - ${course.courseName}`;
        }
        message += `\n   Credits: ${course.credits} | Grade: ${course.grade}`;
        if (course.gradePoints > 0) {
          message += ` | GP: ${course.gradePoints}`;
        }
        message += `\n`;
      });
      
      totalCredits += semester.totalCredits;
      totalGradePoints += semester.totalGradePoints;
    });
    
    if (totalCredits > 0) {
      const cgpa = (totalGradePoints / totalCredits).toFixed(2);
      message += `\n🏆 Overall CGPA: ${cgpa}\n`;
    }
    
    return message;
  }

  formatAssignmentMarks(data) {
    let message = `📊 Assignment Marks Report\n\n`;
    message += `👤 Enrollment: ${data.enrollmentNumber}\n`;
    message += `🎓 Programme: ${data.programCode}\n\n`;
    
    if (Object.keys(data.assignmentMarks).length === 0) {
      message += `❌ No assignment marks found.\n`;
      return message;
    }
    
    message += `📝 Semester-wise Assignment Marks:\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    Object.entries(data.assignmentMarks).forEach(([semester, assignments]) => {
      message += `\n📚 ${semester}:\n`;
      
      assignments.forEach(assignment => {
        message += `▫️ ${assignment.courseCode}\n`;
        message += `   Marks: ${assignment.assignmentMarks}/${assignment.totalMarks}`;
        message += ` (${assignment.percentage}%)\n`;
      });
    });
    
    return message;
  }
}

export default IGNOUService;
