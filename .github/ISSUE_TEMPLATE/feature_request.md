name: Feature Request
description: Request a product or security capability
labels: ["enhancement", "triage"]
body:
  - type: markdown
    attributes:
      value: "Use this template for new capabilities. Security-related ideas are especially welcome."
  - type: input
    id: feature
    attributes:
      label: Feature / capability
      placeholder: "e.g. MITRE ATT&CK mapping for detected threats"
    validations:
      required: true
  - type: textarea
    id: problem
    attributes:
      label: Problem it solves
      description: What user problem is addressed?
    validations:
      required: true
  - type: textarea
    id: value
    attributes:
      label: Security value
      description: How does this improve security posture?
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
  - type: textarea
    id: attachments
    attributes:
      label: Additional context
      label: Attachments / screenshots