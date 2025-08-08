# Key Rotation Operations Runbook

## Overview

This runbook provides comprehensive procedures for managing encryption key rotation in the Google Drive MCP Server. Key rotation is critical for maintaining security compliance and protecting OAuth tokens.

## 🔄 Routine Key Rotation (Quarterly)

### Schedule
- **Frequency**: Every 90 days (quarterly)
- **Timing**: During maintenance window (low usage periods)
- **Duration**: < 30 seconds for typical deployments

### Pre-Rotation Checklist
- [ ] Verify system health: `node dist/index.js health`
- [ ] Confirm backup retention policy is active
- [ ] Check available disk space (minimum 100MB free)
- [ ] Ensure Redis cache is operational (if configured)
- [ ] Notify users of brief service interruption

### Rotation Procedure

1. **Backup Current State**
   ```bash
   # Create manual backup
   cp .gdrive-mcp-tokens.json .gdrive-mcp-tokens.manual-backup.$(date +%Y%m%d-%H%M%S).json
   
   # Verify backup integrity
   node dist/index.js verify-keys
   ```

2. **Execute Key Rotation**
   ```bash
   # Rotate encryption key
   node dist/index.js rotate-key
   
   # Expected output:
   # ✅ Generated new encryption key (v2)
   # ✅ Re-encrypted 5 tokens with new key
   # ✅ Verified all tokens decrypt correctly
   # ✅ Updated key metadata
   # ✅ Key rotation completed successfully
   ```

3. **Post-Rotation Verification**
   ```bash
   # Verify all tokens work with new key
   node dist/index.js verify-keys
   
   # Check key status
   node dist/index.js key-status
   
   # Test server functionality
   node dist/index.js health
   ```

4. **Cleanup Old Backups**
   ```bash
   # Keep only last 5 backups (configurable via GDRIVE_ROTATION_BACKUP_COUNT)
   find . -name ".gdrive-mcp-tokens.backup.*.json" -type f | sort -r | tail -n +6 | xargs rm -f
   ```

### Success Criteria
- ✅ All tokens decrypt successfully with new key
- ✅ Server health check passes
- ✅ No authentication errors in logs
- ✅ Backup files created and verified
- ✅ Old backups cleaned up

## 🚨 Emergency Key Rotation

### Triggers for Emergency Rotation
- Suspected key compromise
- Security incident involving token exposure
- Compliance requirement (audit finding)
- Key exposure in logs or error messages

### Emergency Procedure

1. **Immediate Actions**
   ```bash
   # Stop server immediately
   pkill -f "gdrive-mcp"
   
   # Rotate key immediately (no pre-checks)
   node dist/index.js rotate-key --force
   
   # Restart server
   node dist/index.js &
   ```

2. **Incident Documentation**
   - Log incident details in security incident tracking system
   - Document timeline of compromise and response
   - Record which tokens were potentially exposed
   - Note remediation steps taken

3. **Additional Security Measures**
   ```bash
   # Revoke and refresh all OAuth tokens
   node dist/index.js revoke-all-tokens
   node dist/index.js auth
   
   # Rotate again if compromise was recent
   node dist/index.js rotate-key
   ```

## 📊 Monitoring and Alerting

### Key Performance Indicators (KPIs)
- **Rotation Duration**: < 30 seconds (target)
- **Success Rate**: 100% (no failed rotations)
- **Token Validation**: 100% success post-rotation
- **System Availability**: > 99.9% during rotation

### Monitoring Setup

#### Health Check Script
```bash
#!/bin/bash
# /usr/local/bin/check-gdrive-health.sh

# Check key status
KEY_STATUS=$(node /path/to/gdrive-mcp/dist/index.js key-status 2>&1)
if [ $? -ne 0 ]; then
    echo "CRITICAL: Key status check failed - $KEY_STATUS"
    exit 2
fi

# Check token validity
TOKEN_CHECK=$(node /path/to/gdrive-mcp/dist/index.js verify-keys 2>&1)
if [ $? -ne 0 ]; then
    echo "CRITICAL: Token verification failed - $TOKEN_CHECK"
    exit 2
fi

echo "OK: All systems healthy"
exit 0
```

#### Cron Job Setup
```bash
# Add to crontab for regular monitoring
# Check health every 15 minutes
*/15 * * * * /usr/local/bin/check-gdrive-health.sh

# Weekly key status report
0 9 * * 1 node /path/to/gdrive-mcp/dist/index.js key-status | mail -s "Weekly Key Status Report" admin@company.com
```

### Alert Conditions
- Key rotation failure
- Token decryption failure
- Health check failure > 2 consecutive attempts
- Key age > 100 days (warning)
- Unusual authentication patterns

## 🔧 Troubleshooting Common Issues

### Issue: Key Rotation Fails

**Symptoms:**
```
ERROR: Failed to rotate key - backup creation failed
ERROR: Insufficient disk space for backup
```

**Resolution:**
```bash
# Check disk space
df -h .

# Clean up old logs and temporary files
find . -name "*.log.*" -type f -mtime +30 -delete
find /tmp -name "gdrive-*" -type f -mtime +1 -delete

# Retry rotation
node dist/index.js rotate-key
```

### Issue: Token Decryption Fails After Rotation

**Symptoms:**
```
ERROR: Failed to decrypt token with current key
ERROR: Invalid authentication - token appears corrupted
```

**Resolution:**
```bash
# Check key status
node dist/index.js key-status

# Restore from most recent backup
cp .gdrive-mcp-tokens.backup.$(ls -t .gdrive-mcp-tokens.backup.*.json | head -1) .gdrive-mcp-tokens.json

# Verify restoration
node dist/index.js verify-keys

# Re-authenticate if backup is also corrupted
node dist/index.js auth
```

### Issue: Performance Degradation During Rotation

**Symptoms:**
- Rotation takes > 30 seconds
- High CPU usage during rotation
- Memory warnings in logs

**Resolution:**
```bash
# Check PBKDF2 iteration count (should be 100,000)
echo $GDRIVE_KEY_DERIVATION_ITERATIONS

# Monitor system resources
top -p $(pgrep -f gdrive-mcp)

# Consider reducing iterations temporarily (minimum 100,000)
export GDRIVE_KEY_DERIVATION_ITERATIONS=100000
node dist/index.js rotate-key
```

## 📋 Security Incident Response

### Security Event Classification

#### Level 1 (Low) - Informational
- Routine key rotation completed
- Scheduled maintenance completed
- Non-critical authentication warnings

#### Level 2 (Medium) - Warning  
- Key age exceeds 90 days
- Multiple authentication failures
- Performance degradation during rotation

#### Level 3 (High) - Critical
- Key rotation failure
- Token decryption failure
- Suspected unauthorized access attempts

#### Level 4 (Critical) - Emergency
- Confirmed key compromise
- Tokens exposed in logs or external systems
- Active security breach detected

### Incident Response Procedures

#### Level 3-4 Response Steps

1. **Immediate Containment** (0-15 minutes)
   ```bash
   # Stop server
   systemctl stop gdrive-mcp
   
   # Emergency key rotation
   node dist/index.js rotate-key --force
   
   # Revoke all tokens
   node dist/index.js revoke-all-tokens
   ```

2. **Assessment** (15-30 minutes)
   - Determine scope of potential exposure
   - Review logs for unauthorized access patterns
   - Identify affected user accounts
   - Document timeline of events

3. **Recovery** (30-60 minutes)
   ```bash
   # Re-authenticate with fresh tokens
   node dist/index.js auth
   
   # Verify system integrity
   node dist/index.js health
   
   # Restart server
   systemctl start gdrive-mcp
   ```

4. **Communication** (Within 1 hour)
   - Notify security team
   - Update incident tracking system
   - Prepare user communication if needed

## 📈 Rollback Procedures

### When to Rollback
- New key version causes authentication failures
- Performance significantly degraded after rotation
- Compatibility issues with existing integrations

### Rollback Process

1. **Stop Current Operations**
   ```bash
   systemctl stop gdrive-mcp
   ```

2. **Restore Previous State**
   ```bash
   # Find most recent working backup
   ls -t .gdrive-mcp-tokens.backup.*.json | head -1
   
   # Restore backup
   cp .gdrive-mcp-tokens.backup.YYYYMMDD-HHMMSS.json .gdrive-mcp-tokens.json
   
   # Verify restoration
   node dist/index.js verify-keys
   ```

3. **Restart and Verify**
   ```bash
   systemctl start gdrive-mcp
   node dist/index.js health
   ```

4. **Document Rollback**
   - Record reason for rollback
   - Note any data loss or service impact
   - Plan corrective actions for next rotation attempt

## 🔍 Audit and Compliance

### Audit Trail Requirements
- All key rotations logged with timestamps
- Backup creation and verification logged
- Authentication events tracked
- Security incidents documented

### Compliance Reporting
```bash
# Generate monthly key rotation report
node dist/index.js audit-report --month=$(date +%Y-%m)

# Export authentication logs
grep "KEY_ROTATION\|TOKEN_" .gdrive-mcp-audit.log | tail -100
```

### Documentation Requirements
- Maintain rotation schedule documentation
- Update security policies annually
- Review procedures after incidents
- Train personnel on emergency procedures

## 📞 Emergency Contacts

### Internal Contacts
- **Security Team**: security@company.com
- **System Administrator**: sysadmin@company.com  
- **On-Call Engineer**: +1-555-0123

### External Contacts
- **Google Workspace Support**: [Google Support](https://support.google.com/a/contact/)
- **Cloud Security Vendor**: security-vendor@company.com

---

## 📚 Related Documentation

- [Authentication Flow Guide](./02-authentication-flow.md)
- [Environment Variables Guide](./06-environment-variables.md)
- [Architecture Documentation](../Architecture/ARCHITECTURE.md)
- [Security Documentation](../Architecture/ARCHITECTURE.md#security)

---

*Last Updated: 2025-01-05*  
*Version: 1.0*  
*Owner: Security Team*