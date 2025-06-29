import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

class IGNOUService {
  constructor() {
    this.baseUrls = {
      assignmentStatus: 'https://isms.ignou.ac.in/changeadmdata/StatusAssignment.asp',
      gradeCard: 'https://gradecard.ignou.ac.in/gradecard/'
    };
  }

  async checkAssignmentStatus(enrollmentNumber, programCode) {
    try {
      const formData = new URLSearchParams();
      formData.append('eno', enrollmentNumber);
      formData.append('prog', programCode.toUpperCase());

      const response = await fetch(this.baseUrls.assignmentStatus, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: formData
      });

      const html = await response.text();
      
      if (html.includes('Invalid') || html.includes('invalid') || html.includes('error')) {
        if (html.includes('enrollment') || html.includes('Enrollment')) {
          return { success: false, error: 'Invalid Enrollment Number' };
        } else if (html.includes('programme') || html.includes('Program')) {
          return { success: false, error: 'Invalid Programme Code' };
        } else {
          return { success: false, error: 'Invalid Input - Please check Enrollment Number and Programme Code' };
        }
      }

      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      const assignments = [];
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].querySelectorAll('td');
          if (cells.length >= 4) {
            assignments.push({
              courseCode: cells[0]?.textContent?.trim() || '',
              courseName: cells[1]?.textContent?.trim() || '',
              assignmentCode: cells[2]?.textContent?.trim() || '',
              status: cells[3]?.textContent?.trim() || '',
              submissionDate: cells[4]?.textContent?.trim() || 'N/A'
            });
          }
        }
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
        error: 'Unable to fetch assignment status. Please try again later.' 
      };
    }
  }

  async getGradeCard(enrollmentNumber, programCode) {
    try {
      const formData = new URLSearchParams();
      formData.append('eno', enrollmentNumber);
      formData.append('prog', programCode.toUpperCase());

      const response = await fetch(this.baseUrls.gradeCard, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: formData
      });

      const html = await response.text();
      
      if (html.includes('Invalid') || html.includes('invalid') || html.includes('error')) {
        if (html.includes('enrollment') || html.includes('Enrollment')) {
          return { success: false, error: 'Invalid Enrollment Number' };
        } else if (html.includes('programme') || html.includes('Program')) {
          return { success: false, error: 'Invalid Programme Code' };
        } else {
          return { success: false, error: 'Invalid Input - Please check Enrollment Number and Programme Code' };
        }
      }

      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract student info
      const studentInfo = this.extractStudentInfo(document);
      
      // Extract semester-wise results
      const semesterResults = this.extractSemesterResults(document);
      
      // Extract assignment marks
      const assignmentMarks = this.extractAssignmentMarks(document);

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
        error: 'Unable to fetch grade card. Please try again later.' 
      };
    }
  }

  extractStudentInfo(document) {
    const info = {};
    
    try {
      // Look for student information in various table structures
      const tables = document.querySelectorAll('table');
      
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const text = row.textContent.toLowerCase();
          if (text.includes('name')) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              info.name = cells[1]?.textContent?.trim() || '';
            }
          }
          if (text.includes('programme')) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              info.programme = cells[1]?.textContent?.trim() || '';
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
        const headerRow = rows[0];
        
        if (headerRow && headerRow.textContent.toLowerCase().includes('course')) {
          const semesterData = {
            courses: [],
            totalCredits: 0,
            totalGradePoints: 0,
            sgpa: 0
          };
          
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            if (cells.length >= 4) {
              const course = {
                courseCode: cells[0]?.textContent?.trim() || '',
                courseName: cells[1]?.textContent?.trim() || '',
                credits: parseInt(cells[2]?.textContent?.trim()) || 0,
                grade: cells[3]?.textContent?.trim() || '',
                gradePoints: parseFloat(cells[4]?.textContent?.trim()) || 0
              };
              
              semesterData.courses.push(course);
              semesterData.totalCredits += course.credits;
              semesterData.totalGradePoints += course.gradePoints;
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
        const headerRow = rows[0];
        
        if (headerRow && (headerRow.textContent.toLowerCase().includes('assignment') || 
                         headerRow.textContent.toLowerCase().includes('marks'))) {
          
          for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            if (cells.length >= 3) {
              const courseCode = cells[0]?.textContent?.trim() || '';
              const assignmentMarks = cells[1]?.textContent?.trim() || '';
              const totalMarks = cells[2]?.textContent?.trim() || '';
              
              // Determine semester based on course code pattern
              const semester = this.determineSemester(courseCode);
              
              if (!assignmentsBySemester[semester]) {
                assignmentsBySemester[semester] = [];
              }
              
              assignmentsBySemester[semester].push({
                courseCode,
                assignmentMarks: parseFloat(assignmentMarks) || 0,
                totalMarks: parseFloat(totalMarks) || 0,
                percentage: totalMarks ? ((parseFloat(assignmentMarks) / parseFloat(totalMarks)) * 100).toFixed(2) : '0'
              });
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
    // Basic logic to determine semester from course code
    // This can be enhanced based on IGNOU course code patterns
    if (courseCode.includes('1') || courseCode.endsWith('01')) return 'Semester 1';
    if (courseCode.includes('2') || courseCode.endsWith('02')) return 'Semester 2';
    if (courseCode.includes('3') || courseCode.endsWith('03')) return 'Semester 3';
    if (courseCode.includes('4') || courseCode.endsWith('04')) return 'Semester 4';
    if (courseCode.includes('5') || courseCode.endsWith('05')) return 'Semester 5';
    if (courseCode.includes('6') || courseCode.endsWith('06')) return 'Semester 6';
    
    return 'Other';
  }

  formatAssignmentStatus(data) {
    let message = `📋 Assignment Status Report\n\n`;
    message += `👤 Enrollment: ${data.enrollmentNumber}\n`;
    message += `🎓 Programme: ${data.programCode}\n\n`;
    
    if (data.assignments.length === 0) {
      message += `❌ No assignment records found.\n`;
      return message;
    }
    
    message += `📚 Assignment Details:\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    data.assignments.forEach((assignment, index) => {
      message += `${index + 1}. ${assignment.courseCode}\n`;
      message += `   📖 ${assignment.courseName}\n`;
      message += `   📝 Assignment: ${assignment.assignmentCode}\n`;
      message += `   ✅ Status: ${assignment.status}\n`;
      if (assignment.submissionDate !== 'N/A') {
        message += `   📅 Submitted: ${assignment.submissionDate}\n`;
      }
      message += `\n`;
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
    
    data.semesterResults.forEach((semester, index) => {
      message += `\n📊 Semester ${index + 1} Results:\n`;
      message += `▫️ Total Credits: ${semester.totalCredits}\n`;
      message += `▫️ SGPA: ${semester.sgpa}\n\n`;
      
      semester.courses.forEach(course => {
        message += `📖 ${course.courseCode} - ${course.courseName}\n`;
        message += `   Credits: ${course.credits} | Grade: ${course.grade} | GP: ${course.gradePoints}\n`;
      });
      
      message += `\n`;
    });
    
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