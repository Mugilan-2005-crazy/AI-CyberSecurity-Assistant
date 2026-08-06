# 📁 Assets Structure

## Overview

The `assets/` directory contains documentation and reference materials for the CyberSphere AI platform, including screenshots of the user interface and architectural diagrams for deployment guidance.

## Directory Structure

```
assets/
├── README.md              # This guide explaining the assets structure
├── screenshots/            # Visual documentation of UI components
│   ├── demo-requirements.md # Documentation for demo screenshot requirements
├── architecture/           # Technical architecture diagrams
│   ├── deployment-diagram.md # Infrastructure architecture
│   ├── ai-pipeline.md        # AI processing flow
│   └── data-flow.md         # Application data flows
└── demo/                   # Demo environment and setup
    ├── demo-workflow.md    # Step-by-step demo execution guide
    ├── demo-scenarios.md    # Available demo scenarios
    └── demo-setup.md       # Demo environment configuration
```

## Screenshots Section

### Purpose

The `screenshots/` directory contains visual documentation of the CyberSphere AI platform's user interface. These screenshots provide users and administrators with visual reference for UI components, workflows, and features.

### Contents

#### demo-requirements.md
- **Purpose**: Comprehensive documentation for capturing demo screenshots
- **Content**: Detailed instructions for each screen, including:
  - What needs to be captured
  - Recommended capture method
  - Best practices for screenshot quality
  - Screenshot naming convention
  - Screen layout requirements
- **Use**: Reference guide for teams performing UI documentation

### Screenshot Capture Guidelines

#### General Requirements

1. **Quality Standards**
   - Minimum 1920x1080 resolution
   - 72 DPI for web display
   - PNG format for screenshots
   - File size under 500KB per screenshot

2. **Naming Convention**
   - `{module}-{action}-{state}.{extension}`
   - Examples: `login-successful.png`, `dashboard-security-score.png`
   - Consistent naming across all screenshots

3. **Screen Layout**
   - Standard window size (1920x1080)
   - Operating system: Windows 10/11
   - Browser: Chrome 120+ or Edge 120+
   - Browser zoom: 100%

#### Specific Module Documentation

##### Login Module
- **Screenshots Needed**:
   - `landing-page.png` - Landing page hero section
   - `login-form.png` - Login form with fields
   - `login-success.png` - Successful login redirect
   - `login-error.png` - Invalid credentials error

##### Executive Dashboard
- **Screenshots Needed**:
   - `dashboard-overview.png` - Main dashboard with all widgets
   - `dashboard-security-score.png` - Security score gauge
   - `dashboard-risk-indicators.png` - Threat indicators
   - `dashboard-recent-alerts.png` - Alert timeline

##### AI SOC Analyst
- **Screenshots Needed**:
   - `ai-chat-interface.png` - Main chat interface
   - `ai-message-response.png` - AI response formatting
   - `ai-security-report.png` - Security report card
   - `ai-multimodal.png` - File upload/analyzed state

##### Threat Intelligence Center
- **Screenshots Needed**:
   - `threat-intel-search.png` - CVE search interface
   - `threat-intel-results.png` - IOC correlation results
   - `threat-intel-details.png` - Detailed threat analysis
   - `threat-intel-map.png` - Threat correlation visualization

##### UEBA Module
- **Screenshots Needed**:
   - `ueba-dashboard.png` - User risk scoring dashboard
   - `ueba-timeline.png` - Anomaly detection timeline
   - `ueba-profile.png` - Behavioral profiling view
   - `ueba-risk-rank.png` - Risk ranking display

##### Cloud Security
- **Screenshots Needed**:
   - `cloud-posture.png` - Cloud posture assessment
   - `cloud-compliance.png` - Compliance impact analysis
   - `cloud-remediation.png` - Remediation planning
   - `cloud-multi-cloud.png` - Multi-cloud provider support

##### Incident Response
- **Screenshots Needed**:
   - `incident-analysis.png` - AI-powered incident analysis
   - `incident-recommendations.png` - Response recommendations
   - `incident-report-pdf.png` - Generated PDF report
   - `incident-history.png` - Response history tracking

##### Monitoring & Observability
- **Screenshots Needed**:
   - `monitoring-dashboard.png` - Real-time monitoring view
   - `observability-metrics.png` - OpenTelemetry metrics
   - `prometheus-grafana.png` - Dashboard display
   - `socketio-updates.png` - Real-time updates

### Screenshot Usage

#### Documentation

1. **README.md**
   - Use main screenshots for platform overview
   - Reference screenshots in feature descriptions
   - Include demo screenshots in usage guides

2. **Documentation Files**
   - Use screenshots in architecture guides
   - Include UI examples in troubleshooting
   - Reference screenshots in API documentation

#### Demo Preparation

1. **Demo Script**
   - Navigate to demo screens in sequence
   - Capture screenshots at key interaction points
   - Document successful vs error states

2. **Team Collaboration**
   - Share screenshots across documentation team
   - Use as reference for UI consistency
   - Validate demo workflow completion

### Screenshot Management

#### File Organization

1. **Naming Convention**
   - `module-action-state.png`
   - `login-successful.png` - Login form with successful state
   - `dashboard-risk-indicators.png` - Dashboard showing threat indicators

2. **Folder Structure**
   - Group by module/ feature
   - Include context in filename
   - Add timestamps for version control

#### Version Control

1. **Committed Files**
   - Main UI screenshots committed to repository
   - Generated during demo runs
   - Stored with high quality for documentation

2. **Static Content**
   - No automatic screenshot generation
   - Manual capture required
   - Quality standards maintained

## Architecture Diagrams

### Purpose

The `architecture/` directory contains technical diagrams and flowcharts documenting the platform's architecture, deployment models, and data flow patterns.

### Contents

#### deployment-diagram.md
- **Purpose**: High-level infrastructure architecture
- **Content**: Cloud provider configurations, service mesh, load balancing
- **Use**: Planning and deployment reference

#### ai-pipeline.md
- **Purpose**: AI processing and security pipeline
- **Content**: Multi-stage AI workflow, security validation, provider routing
- **Use**: Understanding AI capabilities and security controls

#### data-flow.md
- **Purpose**: Application data flows and transformations
- **Content**: Data paths, transformations, storage strategies
- **Use**: Performance optimization and debugging

### Architecture Usage

#### Documentation

1. **Architecture Guides**
   - Reference deployment diagrams for infrastructure planning
   - Use AI pipeline documentation for capability planning
   - Reference data flows for performance optimization

2. **Development**
   - Use as reference for component placement
   - Guide integration decisions
   - Inform scaling strategies

#### Training and Onboarding

1. **New Team Members**
   - Review architecture for understanding system design
   - Study deployment patterns for operational guidance
   - Learn data flows for debugging and optimization

2. **Architecture Reviews**
   - Validate design decisions against documented patterns
   - Ensure consistency with established architecture
   - Guide refactoring decisions

### Architecture Management

#### Version Control

1. **Change Documentation**
   - Document architecture changes
   - Update diagrams for significant changes
   - Maintain historical architecture documentation

2. **Review Process**
   - Architecture review gates for major changes
   - Validation of architectural decisions
   - Documentation updates for all changes

#### Tooling

1. **Diagram Generation**
   - Tools used: Mermaid, draw.io, PlantUML
   - Standards: Consistent notation across diagrams
   - Quality: Valid syntax and clear presentation

2. **Maintenance**
   - Regular reviews of architectural documentation
   - Updates for new components and features
   - Validation of accuracy with current implementation

## Demo Environment

### Purpose

The `demo/` directory contains documentation and setup instructions for running platform demos to showcase CyberSphere AI capabilities.

### Contents

#### demo-workflow.md
- **Purpose**: Step-by-step demo execution guide
- **Content**: Complete demo scenario with narration, timing, and required actions
- **Use**: Standardization of demo delivery across teams

#### demo-scenarios.md
- **Purpose**: Available demo scenarios and their focus areas
- **Content**: List of demo scenarios, objectives, and audience
- **Use**: Selecting appropriate demo for different audiences

#### demo-setup.md
- **Purpose**: Demo environment configuration and requirements
- **Content**: Setup instructions, hardware requirements, and prerequisites
- **Use**: Ensuring consistent demo environments

### Demo Workflow Documentation

#### Demo Structure

1. **Opening (30 seconds)**
   - **Objective**: Capture attention and set context
   - **Content**: Brief introduction to CyberSphere AI
   - **Delivery**: Professional, confident presentation

2. **Login & Dashboard (1 minute)**
   - **Objective**: Show platform accessibility and initial state
   - **Content**: Login process, admin account demonstration
   - **Delivery**: Step-by-step with visual aids

3. **AI SOC Analyst (2 minutes)**
   - **Objective**: Demonstrate AI capabilities
   - **Content**: Security question, AI analysis, report generation
   - **Delivery**: Interactive demonstration

4. **Threat Intelligence (1 minute)**
   - **Objective**: Show threat intelligence capabilities
   - **Content**: CVE search, IOC analysis, correlation results
   - **Delivery**: Technical deep dive

5. **UEBA (1 minute)**
   - **Objective**: Demonstrate behavioral analytics
   - **Content**: Risk scoring, anomaly detection, timeline analysis
   - **Delivery**: Security-focused presentation

6. **Cloud & Container Security (1 minute)**
   - **Objective**: Show cloud security capabilities
   - **Content**: Cloud posture assessment, compliance analysis
   - **Delivery**: Technical demonstration

7. **Incident Response (1 minute)**
   - **Objective**: Demonstrate incident response
   - **Content**: Incident analysis, recommendations, report generation
   - **Delivery**: Operational focus

8. **Monitoring (30 seconds)**
   - **Objective**: Show operational capabilities
   - **Content**: Real-time monitoring, metrics display
   - **Delivery**: Technical overview

9. **Closing (30 seconds)**
   - **Objective**: Summarize key capabilities
   - **Content**: Platform capabilities and deployment options
   - **Delivery**: Professional closing

#### Demo Scenarios

##### Executive Demo
- **Audience**: C-level executives, board members
- **Focus**: Business value, ROI, strategic advantages
- **Duration**: 15 minutes
- **Key Points**: ROI, risk reduction, compliance

##### Technical Demo
- **Audience**: IT security teams, SOC analysts
- **Focus**: Technical capabilities, deep features
- **Duration**: 45 minutes
- **Key Points**: Advanced features, integration, automation

##### Developer Demo
- **Audience**: Development teams, DevOps engineers
- **Focus**: Architecture, development practices, deployment
- **Duration**: 30 minutes
- **Key Points**: Architecture, scalability, deployment

### Demo Setup Instructions

#### Development Environment

1. **Prerequisites**
   - Node.js 18+
   - npm 9+
   - MongoDB Atlas connection
   - Google Gemini API key

2. **Setup Steps**
   ```bash
   # Backend setup
   cd backend
   cp .env.example .env
   npm install
   npm run seed
   npm run dev
   
   # Frontend setup
   cd ../frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

3. **Demo Configuration**
   - Enable all security features
   - Set appropriate demo credentials
   - Configure environment for optimal performance

#### Production Environment

1. **Deployment**
   - Deploy to production cluster
   - Configure load balancer
   - Set up monitoring and alerting

2. **Demo Configuration**
   - Disable production alerts during demo
   - Configure demo mode for specific scenarios
   - Set up demo user accounts

### Demo Preparation

#### Pre-Demo Checklist

1. **Technical**
   - Verify all components are running
   - Test demo scenarios in preview
   - Check network connectivity
   - Verify authentication setup

2. **Content**
   - Prepare demo slides
   - Set up projection equipment
   - Test audio/visual equipment
   - Prepare Q&A materials

3. **Environment**
   - Clear workspace
   - Prepare demo materials
   - Check internet connection
   - Verify backup systems

#### Demo Execution

1. **Preparation**
   - Welcome participants
   - Test systems
   - Initialize demo environment

2. **Execution**
   - Follow demo workflow
   - Use prepared narration
   - Respond to questions
   - Handle technical issues

3. **Follow-up**
   - Collect feedback
   - Schedule next steps
   - Provide materials
   - Follow up with contacts

### Demo Management

#### Version Control

1. **Workflow Documentation**
   - Document demo procedures
   - Update scenarios as platform evolves
   - Maintain historical demo materials

2. **Standardization**
   - Consistent demo delivery
   - Measurable outcomes
   - Quality assurance

#### Quality Assurance

1. **Demo Testing**
   - Run demos in different environments
   - Test with different user groups
   - Validate all demo scenarios

2. **Continuous Improvement**
   - Gather feedback from demo participants
   - Update demo materials
   - Refine demo procedures

### Summary

The `assets/` directory provides comprehensive documentation and reference materials for the CyberSphere AI platform, including:

1. **Visual documentation** of UI components and workflows
2. **Technical diagrams** of architecture and data flows
3. **Demo preparation guides** for effective platform demonstrations

This structured approach ensures consistent documentation, quality demonstrations, and smooth deployment across all environments.
