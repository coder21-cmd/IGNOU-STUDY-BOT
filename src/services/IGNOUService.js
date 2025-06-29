import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

class IGNOUService {
  constructor() {
    this.baseUrls = {
      assignmentStatus: 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.asp',
      gradeCard: 'https://gradecard.ignou.ac.in/gradecard/',
      alternateGradeCard: 'https://gradecard.ignou.ac.in/gradecard/gradecard.asp'
    };
  }

  async checkAssignmentStatus(enrollmentNumber, programCode) {
    try {
      console.log(`Checking assignment status for: ${enrollmentNumber}, Program: ${programCode}`);
      
      // The IGNOU website uses a specific form submission format
      const formData = new URLSearchParams();
      formData.append('eno', enrollmentNumber);
      formData.append('prog', programCode.toUpperCase());
      formData.append('submit', 'Submit');

      const response = await fetch(this.baseUrls.assignmentStatus, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1',
          'Referer': 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.asp'
        },
        body: formData,
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log('Response received, length:', html.length);
      
      // Check for error messages in the response
      const lowerHtml = html.toLowerCase();
      
      if (lowerHtml.includes('invalid enrollment') || lowerHtml.includes('enrollment number is invalid')) {
        return { success: false, error: 'Invalid Enrollment Number' };
      }
      
      if (lowerHtml.includes('invalid programme') || lowerHtml.includes('programme code is invalid')) {
        return { success: false, error: 'Invalid Programme Code' };
      }
      
      if (lowerHtml.includes('no records found') || lowerHtml.includes('no assignment found')) {
        return { success: false, error: 'No assignment records found for this enrollment number and programme code' };
      }

      // Parse the HTML response using the actual IGNOU website structure
      const assignments = this.parseIGNOUAssignmentStatus(html);
      
      if (assignments.length === 0) {
        return { 
          success: false, 
          error: 'No assignment records found. Please verify your enrollment number and programme code are correct.' 
        };
      }

      return {
        success: true,
        data: {
          enrollmentNumber,
          programCode: programCode.toUpperCase(),
          assignments
        }
      };

    } catch (error) {
      console.error('Error checking assignment status:', error);
      return { 
        success: false, 
        error: 'Unable to fetch assignment status from IGNOU website. Please try again later.' 
      };
    }
  }

  parseIGNOUAssignmentStatus(html) {
    const assignments = [];
    
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Look for the specific table structure used by IGNOU
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        
        // Skip tables with too few rows
        if (rows.length < 2) continue;
        
        // Check if this is the assignment status table
        let isAssignmentTable = false;
        const headerRow = rows[0];
        if (headerRow) {
          const headerText = headerRow.textContent.toLowerCase();
          if (headerText.includes('name') && headerText.includes('course') && 
              headerText.includes('session') && headerText.includes('status')) {
            isAssignmentTable = true;
          }
        }
        
        if (isAssignmentTable) {
          // Parse assignment data from rows
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            
            if (cells.length >= 5) {
              const assignment = {
                name: this.cleanText(cells[0]?.textContent || ''),
                courseCode: this.cleanText(cells[1]?.textContent || ''),
                session: this.cleanText(cells[2]?.textContent || ''),
                status: this.cleanText(cells[3]?.textContent || ''),
                submissionDate: this.cleanText(cells[4]?.textContent || '')
              };
              
              // Only add if we have meaningful data
              if (assignment.courseCode && assignment.courseCode.length > 2) {
                assignments.push({
                  courseCode: assignment.courseCode,
                  courseName: assignment.name === 'Assignment' ? assignment.courseCode : assignment.name,
                  assignmentCode: assignment.name,
                  status: assignment.status,
                  submissionDate: assignment.submissionDate,
                  session: assignment.session
                });
              }
            }
          }
        }
      }
      
      // If no assignments found with the table method, try alternative parsing
      if (assignments.length === 0) {
        return this.parseIGNOUAssignmentStatusAlternative(html);
      }
      
    } catch (error) {
      console.error('Error parsing IGNOU assignment status:', error);
    }
    
    return assignments;
  }

  parseIGNOUAssignmentStatusAlternative(html) {
    const assignments = [];
    
    try {
      // Try to find assignment data using regex patterns based on the actual IGNOU format
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Look for all table cells and try to identify assignment patterns
      const allCells = document.querySelectorAll('td');
      
      for (let i = 0; i < allCells.length - 4; i += 5) {
        const name = this.cleanText(allCells[i]?.textContent || '');
        const course = this.cleanText(allCells[i + 1]?.textContent || '');
        const session = this.cleanText(allCells[i + 2]?.textContent || '');
        const status = this.cleanText(allCells[i + 3]?.textContent || '');
        const date = this.cleanText(allCells[i + 4]?.textContent || '');
        
        // Check if this looks like assignment data
        if (course && course.match(/^[A-Z]{2,6}\d{1,3}$/i) && 
            (name.toLowerCase().includes('assignment') || name === 'Assignment') &&
            session && status) {
          
          assignments.push({
            courseCode: course,
            courseName: course,
            assignmentCode: name,
            status: status,
            submissionDate: date,
            session: session
          });
        }
      }
      
    } catch (error) {
      console.error('Error in alternative IGNOU parsing:', error);
    }
    
    return assignments;
  }

  async getGradeCard(enrollmentNumber, programCode) {
    try {
      console.log(`Fetching grade card for: ${enrollmentNumber}, Program: ${programCode}`);
      
      const formData = new URLSearchParams();
      formData.append('eno', enrollmentNumber);
      formData.append('prog', programCode.toUpperCase());
      formData.append('submit', 'Submit');

      const response = await fetch(this.baseUrls.gradeCard, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://gradecard.ignou.ac.in/gradecard/'
        },
        body: formData,
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const lowerHtml = html.toLowerCase();
      
      // Check for errors
      if (lowerHtml.includes('invalid enrollment') || lowerHtml.includes('enrollment number is invalid')) {
        return { success: false, error: 'Invalid Enrollment Number' };
      }
      
      if (lowerHtml.includes('invalid programme') || lowerHtml.includes('programme code is invalid')) {
        return { success: false, error: 'Invalid Programme Code' };
      }
      
      if (lowerHtml.includes('no records found') || lowerHtml.includes('no grade card found')) {
        return { success: false, error: 'No grade card found for this enrollment number and programme code' };
      }

      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract student info
      const studentInfo = this.extractStudentInfo(document);
      
      // Extract semester-wise results
      const semesterResults = this.extractSemesterResults(document);
      
      // Extract assignment marks
      const assignmentMarks = this.extractAssignmentMarks(document);

      // Check if we got any meaningful data
      if (Object.keys(studentInfo).length === 0 && semesterResults.length === 0 && Object.keys(assignmentMarks).length === 0) {
        return { 
          success: false, 
          error: 'No grade card data found. Please verify your enrollment number and programme code.' 
        };
      }

      return {
        success: true,
        data: {
          enrollmentNumber,
          programCode: programCode.toUpperCase(),
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
      // Look for student information in various formats
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
      
      // Try alternative extraction methods
      if (!info.name) {
        const nameElements = document.querySelectorAll('*');
        for (const element of nameElements) {
          const text = element.textContent;
          if (text.includes('Name:') || text.includes('Student Name:')) {
            const nameMatch = text.match(/(?:Name|Student Name):\s*([^,\n\r]+)/i);
            if (nameMatch) {
              info.name = this.cleanText(nameMatch[1]);
              break;
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
    // Enhanced logic to determine semester from course code
    const code = courseCode.toUpperCase();
    
    // Common IGNOU patterns
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

  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
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
      message += `\nPlease verify:\n`;
      message += `• Enrollment number is correct\n`;
      message += `• Programme code is correct\n`;
      message += `• You have submitted assignments\n`;
      return message;
    }
    
    message += `📚 Assignment Details (${data.assignments.length} found):\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    data.assignments.forEach((assignment, index) => {
      message += `\n${index + 1}. ${assignment.courseCode}\n`;
      if (assignment.session) {
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
      message += `\nThis could mean:\n`;
      message += `• Results not yet declared\n`;
      message += `• Enrollment/Programme code incorrect\n`;
      message += `• No examinations completed\n`;
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
      message += `\nThis could mean:\n`;
      message += `• Assignment marks not yet updated\n`;
      message += `• No assignments submitted\n`;
      message += `• Enrollment/Programme code incorrect\n`;
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
