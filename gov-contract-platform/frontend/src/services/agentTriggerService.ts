/**
 * Agent Trigger Service - Dispatch events to trigger agents
 * 
 * ใช้เรียกเมื่อมีเหตุการณ์ต่างๆ ในระบบ
 * เช่น อัพโหลดเอกสาร, สร้างสัญญา, ตรวจสอบสัญญา
 */

import { executeAgent } from './agentService'

interface TriggerContext {
  page: string
  userId: string
  contractId?: string
  documentId?: string
  vendorId?: string
  [key: string]: any
}

/**
 * Trigger agents for a specific event
 * 
 * @param event - Event name (document_upload, contract_create, etc.)
 * @param inputData - Data to send to agents
 * @param context - Additional context (page, user, etc.)
 * @returns Array of agent execution results
 */
export async function triggerAgents(
  event: string,
  inputData: Record<string, any>,
  context: TriggerContext
): Promise<any[]> {
  // In a real implementation, this would:
  // 1. Call backend API to find agents registered for this event
  // 2. Execute each agent
  // 3. Return results
  
  // For now, mock implementation
  console.log(`[AgentTrigger] Event: ${event}`, { inputData, context })
  
  return []
}

/**
 * Hook for components to trigger agents
 * 
 * Usage:
 * const { trigger, loading, results } = useAgentTrigger()
 * 
 * await trigger('document_upload', { file_content: '...' }, { page: 'documents' })
 */
export function useAgentTrigger() {
  const trigger = async (
    event: string,
    inputData: Record<string, any>,
    context: TriggerContext
  ) => {
    return await triggerAgents(event, inputData, context)
  }

  return {
    trigger,
    // Add loading state, error handling, etc.
  }
}

/**
 * Predefined trigger helpers for common events
 */
export const AgentTriggers = {
  /**
   * Trigger when document is uploaded
   * Use in: UploadDocument page
   */
  async onDocumentUpload(
    documentContent: string,
    documentId: string,
    userId: string
  ) {
    return triggerAgents(
      'document_upload',
      { document_content: documentContent, document_id: documentId },
      { page: 'documents', userId, documentId }
    )
  },

  /**
   * Trigger when contract is created
   * Use in: CreateContract page
   */
  async onContractCreate(
    contractData: Record<string, any>,
    templateId: string,
    userId: string
  ) {
    return triggerAgents(
      'contract_create',
      { contract_data: contractData, template_id: templateId },
      { page: 'contracts', userId }
    )
  },

  /**
   * Trigger when contract is opened for review
   * Use in: ContractDetail page
   */
  async onContractReview(
    contractData: Record<string, any>,
    contractId: string,
    userId: string
  ) {
    return triggerAgents(
      'contract_review',
      { contract_data: contractData, contract_id: contractId },
      { page: 'contracts', userId, contractId }
    )
  },

  /**
   * Trigger when vendor page is opened
   * Use in: VendorDetail page
   */
  async onVendorCheck(
    vendorData: Record<string, any>,
    vendorId: string,
    userId: string
  ) {
    return triggerAgents(
      'vendor_check',
      { vendor_data: vendorData, vendor_id: vendorId },
      { page: 'vendors', userId, vendorId }
    )
  },

  /**
   * Manual trigger - user clicks a button
   * Use in: Any page with "Ask AI" button
   */
  async onManualTrigger(
    agentId: string,
    input: Record<string, any>,
    context: TriggerContext
  ) {
    const result = await executeAgent(agentId, input, context)
    return [result]
  }
}
