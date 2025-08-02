# Document Approval Processes

## Overview

Formal approval workflows for documents, proposals, and official communications using the Google Drive MCP Server. These processes ensure quality control, compliance, and proper authorization for important organizational documents while maintaining clear audit trails.

## 🎯 Business Value

- **Quality Assurance** - Systematic review ensures document quality and accuracy
- **Compliance Management** - Meet regulatory and organizational approval requirements
- **Risk Mitigation** - Prevent unauthorized or inappropriate content publication
- **Audit Trails** - Complete history of review, feedback, and approval decisions
- **Process Efficiency** - Streamlined workflows reduce approval bottlenecks
- **Version Control** - Clear tracking of document changes through approval cycles

## 📝 Approval Process Categories

### 1. Standard Document Approval
- Internal policies and procedures
- Marketing materials and communications
- Technical documentation
- Training materials
- Process guides

### 2. Regulatory Compliance Approval
- Legal contracts and agreements
- Financial reports and statements
- Compliance documentation
- Safety procedures
- Quality management documents

### 3. Executive Approval
- Strategic plans and proposals
- Budget allocations
- Organizational changes
- Partnership agreements
- Public statements

### 4. Technical Review Approval
- Software documentation
- System architecture documents
- Technical specifications
- Security protocols
- Implementation guides

## 🔄 Core Approval Workflows

### 1. Multi-Stage Approval Process

**Workflow Structure:**
```
📝 Draft Creation
↓
🔍 Initial Review (Author)
↓
👥 Peer Review (Subject Matter Experts)
↓
📈 Management Review (Department Head)
↓
✅ Final Approval (Authorized Approver)
↓
📢 Publication/Distribution
```

**Implementation:**

```javascript
// Create multi-stage approval workflow
const createApprovalWorkflow = async (documentId, approvalConfig) => {
  console.log(`Initiating approval workflow for document: ${documentId}`);
  
  try {
    // 1. Create approval tracking folder
    const approvalFolder = await callTool("createFolder", {
      name: `Approval Process - ${approvalConfig.documentTitle}`,
      parentId: "APPROVAL_PROCESSES_FOLDER_ID"
    });
    
    // 2. Create approval tracking spreadsheet
    const approvalTracker = await createApprovalTracker(
      approvalFolder.id, 
      approvalConfig
    );
    
    // 3. Create review templates for each stage
    const reviewTemplates = await createReviewTemplates(
      approvalFolder.id, 
      approvalConfig.stages
    );
    
    // 4. Initialize approval status
    const approvalStatus = await initializeApprovalStatus(
      approvalTracker.id, 
      approvalConfig
    );
    
    // 5. Create approval summary document
    const approvalSummary = await createApprovalSummary(
      approvalFolder.id,
      documentId,
      approvalConfig
    );
    
    // 6. Start first approval stage
    await startApprovalStage(
      approvalTracker.id,
      approvalConfig.stages[0],
      documentId
    );
    
    console.log(`Approval workflow created successfully`);
    
    return {
      approvalFolder: approvalFolder,
      tracker: approvalTracker,
      templates: reviewTemplates,
      summary: approvalSummary,
      status: approvalStatus
    };
    
  } catch (error) {
    console.error(`Failed to create approval workflow:`, error);
    throw error;
  }
};

// Create approval tracking spreadsheet
const createApprovalTracker = async (folderId, config) => {
  const tracker = await callTool("createFile", {
    name: `Approval Tracker - ${config.documentTitle}`,
    mimeType: "application/vnd.google-apps.spreadsheet",
    parentId: folderId
  });
  
  // Set up tracking structure
  const headers = [
    'Stage', 'Reviewer', 'Role', 'Status', 'Start Date', 
    'Due Date', 'Completion Date', 'Comments', 'Action Required'
  ];
  
  // Initialize stages
  const stageRows = config.stages.map(stage => [
    stage.name,
    stage.reviewer,
    stage.role,
    'Pending',
    '',
    '',
    '',
    '',
    stage.actionRequired || 'Review and provide feedback'
  ]);
  
  await callTool("updateCells", {
    spreadsheetId: tracker.id,
    range: `A1:I${stageRows.length + 1}`,
    values: [headers, ...stageRows]
  });
  
  // Add summary section
  const summaryHeaders = ['Metric', 'Value'];
  const summaryData = [
    ['Document Title', config.documentTitle],
    ['Author', config.author],
    ['Document Type', config.documentType],
    ['Priority Level', config.priority],
    ['Target Completion', config.targetDate],
    ['Current Stage', config.stages[0].name],
    ['Overall Status', 'In Progress']
  ];
  
  await callTool("updateCells", {
    spreadsheetId: tracker.id,
    range: `A${stageRows.length + 3}:B${stageRows.length + 3 + summaryData.length}`,
    values: [summaryHeaders, ...summaryData]
  });
  
  return tracker;
};

// Create review templates for each stage
const createReviewTemplates = async (folderId, stages) => {
  const templates = [];
  
  for (const stage of stages) {
    const template = await callTool("createDocument", {
      title: `${stage.name} - Review Template`,
      content: generateReviewTemplate(stage),
      parentId: folderId
    });
    
    templates.push({
      stage: stage.name,
      template: template
    });
  }
  
  return templates;
};

// Generate review template content
const generateReviewTemplate = (stage) => {
  return `# ${stage.name} Review

## Document Information
- **Review Date:** ${new Date().toISOString().split('T')[0]}
- **Reviewer:** ${stage.reviewer}
- **Stage:** ${stage.name}
- **Due Date:** [To be filled]

## Review Criteria
${stage.reviewCriteria ? stage.reviewCriteria.map(criterion => `- ${criterion}`).join('\n') : '- Content accuracy and completeness\n- Adherence to organizational standards\n- Clarity and readability'}

## Review Comments

### Strengths
- [What works well in this document?]

### Areas for Improvement
- [What needs to be changed or improved?]

### Specific Feedback
| Section | Comment | Priority | Status |
|---------|---------|----------|--------|
| [Section name] | [Specific feedback] | [High/Medium/Low] | [To Address/Addressed] |
| | | | |

## Recommendations
- [ ] **Approve as-is** - Document is ready for next stage
- [ ] **Approve with minor changes** - Small modifications needed
- [ ] **Request revisions** - Significant changes required before proceeding
- [ ] **Reject** - Document does not meet standards

## Additional Comments
[Any additional feedback or suggestions]

## Next Steps
- [What actions should be taken based on this review?]

---
**Reviewer Signature:** ${stage.reviewer}  
**Date:** [To be filled when review is complete]`;
};
```

### 2. Automated Status Tracking

**Implementation:**

```javascript
// Update approval status based on review completion
const updateApprovalStatus = async (trackerId, stageIndex, reviewResult) => {
  console.log(`Updating approval status for stage ${stageIndex}`);
  
  try {
    // 1. Update current stage status
    const currentDate = new Date().toISOString().split('T')[0];
    const statusUpdate = [
      reviewResult.status, // Status
      '', // Start Date (already set)
      '', // Due Date (already set) 
      currentDate, // Completion Date
      reviewResult.comments || 'Review completed',
      reviewResult.decision
    ];
    
    await callTool("updateCells", {
      spreadsheetId: trackerId,
      range: `D${stageIndex + 2}:I${stageIndex + 2}`, // +2 for header and 0-based index
      values: [statusUpdate]
    });
    
    // 2. Determine next action based on review result
    const nextAction = await determineNextAction(reviewResult, stageIndex);
    
    // 3. Update overall status
    await updateOverallStatus(trackerId, nextAction);
    
    // 4. Trigger next stage if approved
    if (reviewResult.status === 'Approved' && nextAction.proceedToNext) {
      await startNextApprovalStage(trackerId, stageIndex + 1);
    }
    
    // 5. Send notifications
    await sendStatusNotifications(trackerId, stageIndex, reviewResult);
    
    console.log(`Status updated successfully`);
    return nextAction;
    
  } catch (error) {
    console.error(`Failed to update approval status:`, error);
    throw error;
  }
};

// Determine next action based on review result
const determineNextAction = async (reviewResult, currentStageIndex) => {
  switch (reviewResult.status) {
    case 'Approved':
      return {
        action: 'proceed',
        proceedToNext: true,
        message: 'Stage approved, proceeding to next stage'
      };
    
    case 'Approved with Changes':
      return {
        action: 'revise_and_proceed',
        proceedToNext: false,
        message: 'Minor revisions required before proceeding',
        revisionsRequired: reviewResult.requiredChanges
      };
    
    case 'Revisions Required':
      return {
        action: 'return_to_author',
        proceedToNext: false,
        message: 'Document returned to author for revisions',
        revisionsRequired: reviewResult.requiredChanges
      };
    
    case 'Rejected':
      return {
        action: 'workflow_terminated',
        proceedToNext: false,
        message: 'Document rejected, workflow terminated',
        reason: reviewResult.rejectionReason
      };
    
    default:
      return {
        action: 'pending',
        proceedToNext: false,
        message: 'Review in progress'
      };
  }
};

// Start next approval stage
const startNextApprovalStage = async (trackerId, nextStageIndex) => {
  // Get tracker data to find next stage info
  const trackerData = await callTool("readSheet", {
    spreadsheetId: trackerId,
    range: "A:I"
  });
  
  if (nextStageIndex < trackerData.values.length - 1) {
    const nextStage = trackerData.values[nextStageIndex + 1]; // +1 for header
    
    // Update next stage start date and due date
    const startDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 5 days from now
    
    await callTool("updateCells", {
      spreadsheetId: trackerId,
      range: `E${nextStageIndex + 2}:F${nextStageIndex + 2}`,
      values: [[startDate, dueDate]]
    });
    
    // Send notification to next reviewer
    await notifyNextReviewer(nextStage, trackerId);
  } else {
    // All stages completed, finalize approval
    await finalizeApproval(trackerId);
  }
};
```

### 3. Review Feedback Management

**Implementation:**

```javascript
// Consolidate feedback from multiple reviewers
const consolidateReviewFeedback = async (approvalFolderId) => {
  // Find all review documents in the approval folder
  const reviewDocs = await callTool("enhancedSearch", {
    query: `parents:${approvalFolderId} AND name:"Review Template"`,
    orderBy: "name"
  });
  
  const consolidatedFeedback = {
    approvalSummary: {
      totalReviews: reviewDocs.files.length,
      approved: 0,
      changesRequested: 0,
      rejected: 0
    },
    feedbackBySection: {},
    commonThemes: [],
    actionItems: [],
    overallRecommendation: ''
  };
  
  // Process each review document
  for (const reviewDoc of reviewDocs.files) {
    const reviewContent = await callTool("read", {
      fileId: reviewDoc.id
    });
    
    const parsedFeedback = parseReviewContent(reviewContent);
    
    // Update approval summary
    switch (parsedFeedback.recommendation) {
      case 'approve':
        consolidatedFeedback.approvalSummary.approved++;
        break;
      case 'approve_with_changes':
        consolidatedFeedback.approvalSummary.changesRequested++;
        break;
      case 'reject':
        consolidatedFeedback.approvalSummary.rejected++;
        break;
    }
    
    // Consolidate section-specific feedback
    for (const [section, feedback] of Object.entries(parsedFeedback.sectionFeedback)) {
      if (!consolidatedFeedback.feedbackBySection[section]) {
        consolidatedFeedback.feedbackBySection[section] = [];
      }
      consolidatedFeedback.feedbackBySection[section].push({
        reviewer: parsedFeedback.reviewer,
        feedback: feedback,
        priority: parsedFeedback.priority || 'Medium'
      });
    }
    
    // Collect action items
    consolidatedFeedback.actionItems.push(...parsedFeedback.actionItems);
  }
  
  // Determine overall recommendation
  consolidatedFeedback.overallRecommendation = determineOverallRecommendation(
    consolidatedFeedback.approvalSummary
  );
  
  // Identify common themes
  consolidatedFeedback.commonThemes = identifyCommonThemes(
    consolidatedFeedback.feedbackBySection
  );
  
  // Create consolidated feedback document
  const consolidatedDoc = await createConsolidatedFeedbackDocument(
    approvalFolderId,
    consolidatedFeedback
  );
  
  return {
    feedback: consolidatedFeedback,
    document: consolidatedDoc
  };
};

// Parse review content to extract structured feedback
const parseReviewContent = (content) => {
  const feedback = {
    reviewer: '',
    recommendation: '',
    sectionFeedback: {},
    actionItems: [],
    priority: 'Medium'
  };
  
  const lines = content.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Extract reviewer name
    if (trimmedLine.includes('**Reviewer:**')) {
      feedback.reviewer = trimmedLine.split('**Reviewer:**')[1].trim();
    }
    
    // Extract recommendation
    if (trimmedLine.includes('- [x]') || trimmedLine.includes('✓')) {
      if (trimmedLine.includes('Approve as-is')) {
        feedback.recommendation = 'approve';
      } else if (trimmedLine.includes('Approve with minor changes')) {
        feedback.recommendation = 'approve_with_changes';
      } else if (trimmedLine.includes('Request revisions')) {
        feedback.recommendation = 'revisions_required';
      } else if (trimmedLine.includes('Reject')) {
        feedback.recommendation = 'reject';
      }
    }
    
    // Extract section feedback (simplified parsing)
    if (trimmedLine.startsWith('###')) {
      currentSection = trimmedLine.replace('###', '').trim();
    } else if (currentSection && trimmedLine.startsWith('-')) {
      if (!feedback.sectionFeedback[currentSection]) {
        feedback.sectionFeedback[currentSection] = [];
      }
      feedback.sectionFeedback[currentSection].push(trimmedLine.substring(1).trim());
    }
  }
  
  return feedback;
};

// Create consolidated feedback document
const createConsolidatedFeedbackDocument = async (folderId, feedback) => {
  const content = `# Consolidated Review Feedback

## Approval Summary
- **Total Reviews:** ${feedback.approvalSummary.totalReviews}
- **Approved:** ${feedback.approvalSummary.approved}
- **Changes Requested:** ${feedback.approvalSummary.changesRequested}
- **Rejected:** ${feedback.approvalSummary.rejected}

**Overall Recommendation:** ${feedback.overallRecommendation}

## Common Themes
${feedback.commonThemes.map(theme => `- ${theme}`).join('\n')}

## Feedback by Section
${Object.entries(feedback.feedbackBySection).map(([section, items]) => `
### ${section}
${items.map(item => `- **${item.reviewer}:** ${item.feedback} (${item.priority} Priority)`).join('\n')}`).join('\n')}

## Action Items
${feedback.actionItems.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## Next Steps
Based on the consolidated feedback, the following actions are recommended:

${generateNextStepsRecommendations(feedback)}

---
*Generated on: ${new Date().toISOString().split('T')[0]}*`;
  
  const consolidatedDoc = await callTool("createDocument", {
    title: "Consolidated Review Feedback",
    content: content,
    parentId: folderId
  });
  
  return consolidatedDoc;
};
```

### 4. Approval Workflow Analytics

**Implementation:**

```javascript
// Generate approval workflow analytics
const generateApprovalAnalytics = async (period = 90) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (period * 24 * 60 * 60 * 1000));
  
  // Collect approval data
  const approvalProcesses = await callTool("enhancedSearch", {
    query: `name:"Approval Tracker" AND type:spreadsheet`,
    filters: {
      modifiedAfter: startDate.toISOString()
    }
  });
  
  const analytics = {
    totalProcesses: approvalProcesses.files.length,
    averageApprovalTime: 0,
    approvalRates: {
      approved: 0,
      rejected: 0,
      inProgress: 0
    },
    bottleneckStages: {},
    reviewerPerformance: {},
    documentTypes: {}
  };
  
  // Analyze each approval process
  let totalApprovalTime = 0;
  let completedProcesses = 0;
  
  for (const process of approvalProcesses.files) {
    const processData = await analyzeApprovalProcess(process.id);
    
    // Update approval rates
    analytics.approvalRates[processData.status]++;
    
    // Calculate approval time for completed processes
    if (processData.completionTime) {
      totalApprovalTime += processData.completionTime;
      completedProcesses++;
    }
    
    // Track bottleneck stages
    for (const [stage, duration] of Object.entries(processData.stageDurations)) {
      if (!analytics.bottleneckStages[stage]) {
        analytics.bottleneckStages[stage] = [];
      }
      analytics.bottleneckStages[stage].push(duration);
    }
    
    // Track reviewer performance
    for (const reviewer of processData.reviewers) {
      if (!analytics.reviewerPerformance[reviewer.name]) {
        analytics.reviewerPerformance[reviewer.name] = {
          totalReviews: 0,
          averageTime: 0,
          approvalRate: 0
        };
      }
      analytics.reviewerPerformance[reviewer.name].totalReviews++;
      analytics.reviewerPerformance[reviewer.name].averageTime += reviewer.reviewTime;
    }
    
    // Track document types
    const docType = processData.documentType;
    analytics.documentTypes[docType] = (analytics.documentTypes[docType] || 0) + 1;
  }
  
  // Calculate averages
  if (completedProcesses > 0) {
    analytics.averageApprovalTime = totalApprovalTime / completedProcesses;
  }
  
  // Calculate bottleneck averages
  for (const [stage, durations] of Object.entries(analytics.bottleneckStages)) {
    analytics.bottleneckStages[stage] = {
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      max: Math.max(...durations),
      min: Math.min(...durations),
      count: durations.length
    };
  }
  
  // Finalize reviewer performance calculations
  for (const reviewer of Object.values(analytics.reviewerPerformance)) {
    reviewer.averageTime = reviewer.averageTime / reviewer.totalReviews;
  }
  
  // Create analytics report
  const analyticsReport = await createAnalyticsReport(analytics, period);
  
  return {
    analytics: analytics,
    report: analyticsReport
  };
};

// Analyze individual approval process
const analyzeApprovalProcess = async (processId) => {
  const processData = await callTool("readSheet", {
    spreadsheetId: processId,
    range: "A:I"
  });
  
  const analysis = {
    status: 'inProgress',
    completionTime: null,
    stageDurations: {},
    reviewers: [],
    documentType: 'Unknown'
  };
  
  if (processData.values && processData.values.length > 1) {
    // Extract document type from summary section
    const summarySection = processData.values.slice(10); // Assuming summary starts around row 10
    for (const row of summarySection) {
      if (row[0] === 'Document Type') {
        analysis.documentType = row[1];
        break;
      }
    }
    
    // Analyze stages
    const stages = processData.values.slice(1, 10); // Assuming stages are in rows 1-10
    let processStartDate = null;
    let processEndDate = null;
    
    for (const stage of stages) {
      const [stageName, reviewer, role, status, startDate, dueDate, completionDate] = stage;
      
      if (startDate && !processStartDate) {
        processStartDate = new Date(startDate);
      }
      
      if (completionDate) {
        processEndDate = new Date(completionDate);
        
        // Calculate stage duration
        if (startDate) {
          const stageStart = new Date(startDate);
          const stageEnd = new Date(completionDate);
          const duration = (stageEnd - stageStart) / (1000 * 60 * 60 * 24); // days
          analysis.stageDurations[stageName] = duration;
        }
        
        // Track reviewer performance
        analysis.reviewers.push({
          name: reviewer,
          stage: stageName,
          reviewTime: analysis.stageDurations[stageName] || 0
        });
      }
      
      if (status === 'Rejected') {
        analysis.status = 'rejected';
        break;
      }
    }
    
    // Determine overall status
    const allStagesCompleted = stages.every(stage => stage[6]); // completion date exists
    if (allStagesCompleted && analysis.status !== 'rejected') {
      analysis.status = 'approved';
      
      if (processStartDate && processEndDate) {
        analysis.completionTime = (processEndDate - processStartDate) / (1000 * 60 * 60 * 24); // days
      }
    }
  }
  
  return analysis;
};
```

## 📅 Advanced Approval Features

### 1. Conditional Approval Routing

**Implementation:**

```javascript
// Dynamic approval routing based on document attributes
const createConditionalApprovalRouting = (documentAttributes) => {
  const routingRules = [
    {
      condition: doc => doc.value > 10000 && doc.type === 'financial',
      approvers: ['CFO', 'CEO'],
      requiredStages: ['Financial Review', 'Executive Approval']
    },
    {
      condition: doc => doc.type === 'legal',
      approvers: ['Legal Counsel', 'Department Head'],
      requiredStages: ['Legal Review', 'Management Approval']
    },
    {
      condition: doc => doc.confidentiality === 'high',
      approvers: ['Security Officer', 'Executive Team'],
      requiredStages: ['Security Review', 'Executive Approval']
    },
    {
      condition: doc => doc.type === 'policy' || doc.scope === 'organization',
      approvers: ['Department Heads', 'Executive Team'],
      requiredStages: ['Department Review', 'Executive Approval']
    }
  ];
  
  // Apply routing rules
  const applicableRules = routingRules.filter(rule => 
    rule.condition(documentAttributes)
  );
  
  // Combine approvers and stages from all applicable rules
  const combinedApprovers = [...new Set(
    applicableRules.flatMap(rule => rule.approvers)
  )];
  
  const combinedStages = [...new Set(
    applicableRules.flatMap(rule => rule.requiredStages)
  )];
  
  return {
    approvers: combinedApprovers,
    stages: combinedStages,
    priority: determinePriority(documentAttributes),
    escalationPath: defineEscalationPath(documentAttributes)
  };
};

// Determine document priority based on attributes
const determinePriority = (attributes) => {
  if (attributes.urgent || attributes.value > 50000) {
    return 'High';
  } else if (attributes.value > 10000 || attributes.scope === 'department') {
    return 'Medium';
  } else {
    return 'Low';
  }
};
```

### 2. Automated Escalation System

**Implementation:**

```javascript
// Automatic escalation for overdue approvals
const checkAndEscalateOverdueApprovals = async () => {
  console.log('Checking for overdue approvals...');
  
  // Find all active approval processes
  const activeApprovals = await callTool("enhancedSearch", {
    query: `name:"Approval Tracker" AND type:spreadsheet`,
    orderBy: "modifiedTime desc"
  });
  
  const overdueProcesses = [];
  
  for (const approval of activeApprovals.files) {
    const approvalData = await callTool("readSheet", {
      spreadsheetId: approval.id,
      range: "A:I"
    });
    
    if (approvalData.values && approvalData.values.length > 1) {
      const stages = approvalData.values.slice(1, 10);
      
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const [stageName, reviewer, role, status, startDate, dueDate, completionDate] = stage;
        
        // Check if stage is overdue
        if (status === 'Pending' && dueDate && !completionDate) {
          const due = new Date(dueDate);
          const now = new Date();
          
          if (now > due) {
            const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
            
            overdueProcesses.push({
              approvalId: approval.id,
              stageName: stageName,
              reviewer: reviewer,
              daysOverdue: daysOverdue,
              escalationRequired: daysOverdue > 2
            });
          }
        }
      }
    }
  }
  
  // Process escalations
  for (const overdue of overdueProcesses) {
    if (overdue.escalationRequired) {
      await escalateApproval(overdue);
    } else {
      await sendReminderNotification(overdue);
    }
  }
  
  return overdueProcesses;
};

// Escalate overdue approval to next level
const escalateApproval = async (overdueInfo) => {
  console.log(`Escalating approval: ${overdueInfo.stageName}`);
  
  // Create escalation document
  const escalationDoc = await callTool("createDocument", {
    title: `Escalation Notice - ${overdueInfo.stageName}`,
    content: `# Approval Escalation Notice

## Overdue Approval Details
- **Stage:** ${overdueInfo.stageName}
- **Original Reviewer:** ${overdueInfo.reviewer}
- **Days Overdue:** ${overdueInfo.daysOverdue}
- **Escalation Date:** ${new Date().toISOString().split('T')[0]}

## Reason for Escalation
This approval has been pending for more than the allowed timeframe and requires immediate attention.

## Required Action
Please review the pending approval and either:
1. Complete the review yourself, or
2. Assign an alternate reviewer, or
3. Extend the deadline with justification

## Original Approval Link
[Link to approval tracker]

---
*This is an automated escalation notice.*`,
    parentId: "ESCALATIONS_FOLDER_ID"
  });
  
  // Update approval tracker with escalation notice
  await callTool("updateCells", {
    spreadsheetId: overdueInfo.approvalId,
    range: `H${getStageRowIndex(overdueInfo.stageName)}:H${getStageRowIndex(overdueInfo.stageName)}`,
    values: [[`ESCALATED: ${overdueInfo.daysOverdue} days overdue`]]
  });
  
  return escalationDoc;
};
```

## 🔍 Quality Assurance Integration

### Approval Quality Metrics

**Implementation:**

```javascript
// Track approval quality and effectiveness
const trackApprovalQuality = async (approvalId, finalDocumentId) => {
  // Measure quality indicators
  const qualityMetrics = {
    timeToApproval: await calculateApprovalTime(approvalId),
    reviewThoroughness: await assessReviewThoroughness(approvalId),
    documentQuality: await assessFinalDocumentQuality(finalDocumentId),
    stakeholderSatisfaction: await collectStakeholderFeedback(approvalId),
    complianceScore: await checkComplianceAdherence(approvalId)
  };
  
  // Store quality data
  await storeQualityMetrics(approvalId, qualityMetrics);
  
  // Generate quality report
  const qualityReport = await generateQualityReport(qualityMetrics);
  
  return {
    metrics: qualityMetrics,
    report: qualityReport
  };
};

// Assess review thoroughness based on feedback detail
const assessReviewThoroughness = async (approvalId) => {
  const approvalFolder = await getApprovalFolder(approvalId);
  const reviewDocs = await callTool("enhancedSearch", {
    query: `parents:${approvalFolder.id} AND name:"Review Template"`,
    orderBy: "name"
  });
  
  const thoroughnessScores = [];
  
  for (const reviewDoc of reviewDocs.files) {
    const content = await callTool("read", {
      fileId: reviewDoc.id
    });
    
    // Analyze content for thoroughness indicators
    const score = calculateThoroughnessScore(content);
    thoroughnessScores.push(score);
  }
  
  return thoroughnessScores.length > 0 
    ? thoroughnessScores.reduce((a, b) => a + b, 0) / thoroughnessScores.length
    : 0;
};

// Calculate thoroughness score based on review content
const calculateThoroughnessScore = (content) => {
  let score = 0;
  
  // Check for specific feedback elements
  const thoroughnessIndicators = [
    { pattern: /specific feedback/i, weight: 10 },
    { pattern: /section.*comment/i, weight: 15 },
    { pattern: /recommendation/i, weight: 10 },
    { pattern: /areas for improvement/i, weight: 10 },
    { pattern: /strengths/i, weight: 5 },
    { pattern: /\|.*\|.*\|/g, weight: 5 }, // Table entries
    { pattern: /- \[.*\]/g, weight: 5 }, // Checklist items
  ];
  
  for (const indicator of thoroughnessIndicators) {
    const matches = content.match(indicator.pattern);
    if (matches) {
      score += matches.length * indicator.weight;
    }
  }
  
  // Normalize score to 0-100 scale
  return Math.min(100, score);
};
```

## 🔧 Troubleshooting

### Common Approval Process Issues

#### Issue: Approvals Getting Stuck in Review
**Symptoms:** Long delays in approval stages
**Solution:**
```javascript
// Implement automatic deadline extensions with notifications
const handleStuckApprovals = async (approvalId) => {
  const approvalData = await getApprovalData(approvalId);
  const stuckStages = identifyStuckStages(approvalData);
  
  for (const stage of stuckStages) {
    // Offer automatic extension with notification
    const extensionOffered = await offerDeadlineExtension(stage);
    
    if (!extensionOffered.accepted) {
      // Escalate to supervisor
      await escalateToSupervisor(stage);
    }
  }
};
```

#### Issue: Inconsistent Review Quality
**Symptoms:** Varying levels of detail in reviews
**Solution:**
```javascript
// Implement review quality scoring and feedback
const improveReviewQuality = async () => {
  // Provide review training materials
  await createReviewTrainingMaterials();
  
  // Implement review quality scoring
  await setupReviewQualityTracking();
  
  // Provide feedback to reviewers
  await provideReviewerFeedback();
};
```

## 📉 Best Practices

### Process Design
- **Clear Criteria:** Define specific approval criteria for each stage
- **Reasonable Deadlines:** Set realistic timeframes for each review stage
- **Escalation Paths:** Establish clear escalation procedures for delays
- **Training:** Provide reviewer training on standards and expectations

### Documentation Standards
- **Template Consistency:** Use standardized templates for all reviews
- **Feedback Quality:** Require specific, actionable feedback
- **Decision Rationale:** Document the reasoning behind approval decisions
- **Version Control:** Maintain clear version history throughout the process

### Performance Monitoring
- **Time Tracking:** Monitor approval cycle times and identify bottlenecks
- **Quality Metrics:** Track the quality of both reviews and final documents
- **Stakeholder Satisfaction:** Regularly survey process participants
- **Continuous Improvement:** Use analytics to optimize approval workflows

### Compliance and Audit
- **Complete Records:** Maintain comprehensive audit trails
- **Access Controls:** Ensure appropriate access restrictions
- **Retention Policies:** Follow organizational record retention requirements
- **Regular Reviews:** Periodically review and update approval processes

---

*These approval process frameworks provide a robust foundation for managing document approvals while maintaining quality, compliance, and efficiency standards.*