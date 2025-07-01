import {
    Adapter,
    AdapterState,
    isInBrowser,
    WalletReadyState,
    WalletSignMessageError,
    WalletNotFoundError,
    WalletDisconnectedError,
    WalletConnectionError,
    WalletSignTransactionError,
    WalletSwitchChainError,
    WalletGetNetworkError,
    isInMobileBrowser,
} from '@tronweb3/tronwallet-abstract-adapter';
import type {
    Transaction,
    SignedTransaction,
    AdapterName,
    BaseAdapterConfig,
    Network,
} from '@tronweb3/tronwallet-abstract-adapter';
import { getNetworkInfoByTronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import type { Tron, TronWeb } from '@tronweb3/tronwallet-adapter-tronlink';
import { supportTomowallet } from './utils.js';

declare global {
    interface Window {
        tomo_wallet?: {
            tron?: Tron | undefined;
        };
    }
}
export interface TomoWalletAdapterConfig extends BaseAdapterConfig {
    /**
     * Timeout in millisecond for checking if Tomo wallet exists.
     * Default is 3 * 1000ms
     */
    checkTimeout?: number;
    /**
     * The icon of your dapp. Used when open Tomo app in mobile device browsers.
     */
    dappIcon?: string;
    /**
     * The name of your dapp. Used when open Tomo app in mobile device browsers.
     */
    dappName?: string;
}

export const TomoWalletAdapterName = 'Tomo Wallet' as AdapterName<'Tomo Wallet'>;

export class TomoWalletAdapter extends Adapter {
    name = TomoWalletAdapterName;
    url = 'https://tomo.inc/';
    icon =
        'data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDI0MCAyNDAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+Cgk8dGl0bGU+ZmF2aWNvbjwvdGl0bGU+Cgk8ZGVmcz4KCQk8aW1hZ2UgIHdpZHRoPSIyMzQiIGhlaWdodD0iMTYzIiBpZD0iaW1nMSIgaHJlZj0iZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFPb0FBQUNqQ0FNQUFBQ3pIWExZQUFBQUFYTlNSMElCMmNrc2Z3QUFBdUpRVEZSRkFBQUEvejZmL3oyYS96bWMvd0NBL3oyZC9qeWMvanljL2p5ZC96eWQvd0QvLzBDZi9qdWMvanliLzBDQS9qeWMvVHlkL1R1Yy96eWMvejJjL3p5Yy9qeWMvanljL3oyYi96eWQvanljL2p5Yy96dWQvenFaL2p5Yy9qeWMvenVkL3pPWi96eWQvanljL2p5Yy9qeWMvVHVjL3oyYy96cVgvanljL2p5Yy9qMmMvejJjL3ptcS96dWIvanliL2p5Yy96eWIvenFhL2p5Yi9qeWIvanljL3oyZS95dXEvanljL2p1Yy96NmIvVDJiL2oyYy96T1ovenVjL2p5Yy96MmMvenliL3p5ZS9qeWMvanlkL3p5Yy96eWEvanljL3p1Yi9qdWQvejJaL2p5Yy96cWQvenVkL3p5Yy96dWMvem1jL1R5Yy9UeWMvenlXL2p5Yy9UeWMvVHljL2p5ZC9UeWQvanVjL3ptaC96eWMvMENiL3p5Wi96dWQvejZlL3pxYy96eWIvanljLzBDZi96dWMvenliL3oyYy96dWIvejZhLzFXcS96eWMvejJiLzBhaS9UeWIvanljL2oyZC9qeWQvVHljL1R5Yy9UeWMvejJiL1R1Yi9UeWQvanljL2p1Yy9qeWIvanljL3p5Yi9qeWMvanljL3oyZS96MmUvenliL3p5ZS96NmIvMENmLzBTWi9qMmMvanljL2p5Yy9qeWMvanljL2p5Yy9qeWMvVHljL1QyYi9UMmMvVDJkL1R1Yy96dWQvenVkL3p1Yy9qeWMvanliL3p5Yy96MmQvenliL3o2Yi9qeWMvanljL3ptWi96eWEvenVkL3oyYy8wbVMvejJkL2p5Yy9qeWQvVHVjL1R5Yy9qeWMvVHlkL3pxYy9UMmMvejZmL2p5Yy9UeWIvenVhL3oyYi9qeWQvenlkL1QyYy96MmQvejJkL3p1ZC9qeWMvMENWL2p5Yy96eWIvenVkLzBDWi9qeWMvanljL2oyYy96MmMvejZjL2p5Yy9UeWQvanljL3oyYy9UdWIvejJlL2p5Yy9qeWMvanljL3plYi96eWQvemFoL2p5Yy96dWIvenFkL3oyYy9qeWMvenliL2p5Yy96dWQvanljL1R5ZC9qMmMvejJiL1R5Yy9qdWMvVHlkL2p5Yy96dWQvemVrLzBDZi96eWUvejZjL2p5Yy9UdWMvVHlkL2oyYy9UeWIvVDJiL3p5Yi9qeWMvVHljL3p5Yy9UeWMvenViL3oyYy9qeWMvVHViL1R5Yy96eWMvVDJjL3p5Yy96dWIvenFhL1R5YlVCc29qd0FBQVBaMFVrNVRBQ1ZISkFKZzJQL1hYZ0VJc0s0RXRKU2JkM1pWL2Y1Y1BQZjVRU1BxN1NjS2NzZjA0Wjg3RnR6aXhuRUpPT1MvUURYMndQVXlCdDNCUW8vYkJWL0NRMjVFdzhWTlRQeFN2Um5FUmtsSWJCS0ppQkhlbllPem50OGJieHdlY0IwZmM4Z2dkR1prUFRvRGFta0xnTzdLdUtlVmhFK0ZmOC9PemN4NDVlTXFQek1pSVJBUDdPdmEyY20zdHFXa2s0S0JUalI1MU5KaWJXc3A0TlVvSm1nMkIyVzY2YU9pKzZZc3FDMnFxU3N1cXkrR2VuVU44QXptZTFzVTh1KzVXRDc2aDlOK2toWG5zdmdYVVJPOGZUbEw4Vm5XR3VpWnRWU1FySkd0Vmc0WU56SFJqb3l4bkpkaDBKcDhtRXBRODRxTlhhQmFSVENoUTZnNlhRQUFEbnhKUkVGVWVKemRYWGxjVk5VWG41dG9PdFNNcVFtRi9sUndDeGpDSlVORmdhelVJSlhLY2tITFVFUk5zMXd5RTNmTG9sREJCWE1YTTQwVURTdzBLMzVtbHY2UTNETUZBbE16YmRFK2JwOG8rTTA0OCtZdDk3NDU3OTYzeVBEOUErNDc3N3o3em5mZWR1KzU1NTZMVE1ZRElSUDY5emFjMXVnVCtpRGtPS2Y5NzNXRHoydzBWVjlVNFNyVnFieG03S2tOcG1wQk45M2x1bFYvR1hwdWc2bld2eUhZTVA5cDZMbU5wZHBBZk0vZTlidVJKemVVYWlNa3ZtV3Q2RmNEejI0a1ZYLzBoMFRTRUowejd2UUdVbTJDTG1JeVAxUnUyUG0xb3RyYy9xSDh5NHJRS1ZtTk51Z25nclJGMVkreVI3U3U4dm5OY2lkQ3h6U3d6NlFaVlJ0eVdkd1dIU0pyaEY0bjM2c0JaaGttNFZVbm5ZWEF1dCtydE00SmJhaTJROGZkNWRBTEpFNCs5ZjZXT2JiT2pYOEkwZ0IvL2hld29mK3BzczRGVGFoMkVsL0tkdWhiVEtYTFFkbWpPK3pEUkoyclJCZXlJOXJMYkJzUFRhaDJPeUFSUEl6K0t4WkU0K1I1ZEM0UWI4ZWdieVFhZDl3d3FZY21WQ1B3aHlrUzdSWnNQU2FsTG9LbC9VN0Jsbi80VjVoR3FQdzlvUnhhVU8xZFNHck05a0E3dUdMYytlTUVCUjRoQWJsY01mWW02VjYxZFB5TTJUbzN0S0RhWnlkWkhsa3YzL0hHNll1dWU3cW1Ea1Q1b3EzMmZ6NjlTa3ZJQ2owL1VXR2ZDMXBRN2I1ZmJrOGNRaFYxU284cXFNTVdXT0Z6QjhxUjIvM3dIaWJMUk5DQUt2bisxUmFXUno5VVhZY0dWQWR0VVY4SENPbGJtZ0VhVUgzaUMvVjFnT2o2cGVvcTFGTWR2TXNJWjRMMThRMXFxMUJQTmFSWWRSVks4R3lXMmhyVVV3MlcrVDVvakVqVmo0bHFxa1B6cjZpdFFoR3N2ZGVwckVFMTFSZlVmd1dVNFg1U2Q1Y0dxcWtPMjZpMkJvVUlLRlZaZ1ZxcVJ0Mi85anM0YnJXNkN0UlNUVlQ5RFZDTWhGWHFqbGRKMWZ5UGNYNDRkSWU2VVI2VmxnNVgvYldqd05BVnFnNVhSeldwU0VtdlJTdllPaXhYYzdneXFwWm12NWorZVBCSTNIYVJOQmx0ay9xdzlVVklSR1dtU05BM0wreHdBOU45NVlxYXBrcW9qa0hvZlZmUnovdzRzaVBuN0xpaU9yYXZaZnlnT3FKRjNORy8yNmMzaWEreVk5ZDFiaGdrcVc1MkdYeXNBcW9EbXk1U1k1MGhHSDhHYnNuQVZFUGpGbWhoak01NE5SMGNtSWFwVG4xUEUxdjBCdnpWQmFtYVgzbFhHMXQweHFTNWtBWklOZVVkYlV6UkhmN1FtQjVJdFhPUlJxYm9qZGRtQXdvZzFSaDhSS1Y2b2dzK0tDQUdTSFhHZkkxTTBSdGgwSEFkU0hYbVd4cVpvamVtemdBVVFLcXo1MmxraXQ2WWxnSW93QitiU0dqQXBYb2dhaS9VeFlPYkVIUG5hR09MenBqK0JxUUJVMzF6bGlhbTZJMlpyME1hTU5YNTBPTmVQVEJvRGFRQlUzMTd1aWFtNkkwNWt5RU5tR3JxTkUxTTBSdnpKa0lhTU5YNldvUmM2STgzSjBBYU1OVTA4SG12RnBqL0NxUUJVelZvcEUwdDRKRTZtQ29XbEZROUFZYzJ3VlFYdnFhSktYcWoyMjVJQTZicWIyellPU3VheWNlc3VnQlRYUVIrc0tvRnBvQ05PcGlxbC9UTkc0SHg0akRWOUVtYW1LSTM0Q2tQSUZXZkJXQXpwRnJndmNtcU8zRWoxbXRraTk1SUd3TW9RRlNUQ2owSGZWWWZnT04wbnFrbWg2MzBGcVoycm9tSE16M3Q5MFExczZUbE9JM04wUmZ4VFlPUzVmZktVcDMxNDJVallnZTFSc2FSVURtMlpLb3YzdlJLbms1a0hIbHdCRWxPb1BwOGhSZnpkQ0xqU0M0K2dpT2xhdWRaYUZRa2txN0lPQkkrWEN3UlVRM3RiazB6MGh5ZDhXckxCY0taV1VLcXRocy9HMjJOemtpdi9TSy9JYUE2WThOWjQ0M1JHU0V2OFZ4NXFtdDJ5czZIOEdLRVY3bWRLRHpWVmFOdml5MTZZL2tMWEltbnVpN3BkbGlpTzNoWE9FODFUSDdPckRjamZoTlg0cW5PZzJJSnZCTXJobklsbnVyck5lbVR5bU5rT2xmaXFVN011QzJtNkkwKzJWeUpwMXFyaDNjTWo5TWg2b1M3c1NCb1FtUU5KK2w2T1ZZbHVJc0NxbWpEaXdSZDcwYlVqM3dQUjlnR2ZoY01KL0E2ckJ6Q2w0VlUwV00xN1dtTjZpL29wSXM2Y1J1SEdXMkx6cGdyZE5lTHFHYW1HSnZzU1c5WTBnY0t0c1JlaVBITGpMVkZaNndaSk53U1U2MVpsMVY4VWFXK3BVM1BHMm1MemhpMVVMUXBvWnFTV1hNdXEyWHhjNkp0cWNmd295R21tb0lOL2NYYlVxb2ZqNm9wbDlXNjdHbXhBSE41Yngwb2xYZ3BzcDZWQ0RDcU9RTU1Na1Z2YklxWENQQ0JETU5tVk91TG9CTlNDVTQxL2xORFRORWJtL3RKSlRoVlExS3k2SStGbzZRU25PcDI2ZVBzbmNqdUk1WGdWR3RJOXdhUEQ4YW81cUtucFNLdlJGS3ZXSWtFbzlwZmc5UmMxUUlqRmtzRVVxcFBEbUIxTU9WY3V3dmxuS2xuTW8zY3UzcFY1aytwVHpMV2s0ZVdKNk9TdkZvbVV6M2ZySmVXdmM3cWljL3ZVU2tXU0tqMnZNUVV2R1BwTUdCWWxWaVU3QmVUVEo5MVpSYzZseWlPS2pPdnY3aVlMZmRQeUwzaTlIUmlxaUVYV1ZyQTZWTjdmVURjTVdQak5acGt4N1lGeDhuUktiVkdkU0lHY2dDd05CWmROeUhWNU1HUE1sUVlIdmFEZkpyTW9jVy9LaDJmVHJyd2NxVHN6dWErN3o5Q2FaY0R1ejhRQkcwSnFEYi9yUUpYaHBCYnZORnpQdENFMFRGSzZyR21OWmNuNmtEbzB0clJpcTF5bzNhak1uZVpwL3BkQWNNMHFka240SVJQKzBmQXc1a3pQL0dVbE5TSmxDME16K3lzNkFpdTZLYTZJaitQdXA3ODdLVksxQTRnenhmTVpQcndUdWxIa0FTZjc1Nmdqek9LNjhVOTVoelZnL24wTC9XVVpRb3pjU2YvNnJFTFllMmFTMG9SVEVBUmlvQ1ZKRWk2eDhYTVJmWFFqV2pxT2c2a0tjOVdWdS9UWHJMN21nUitycmllemZQb3gvWUw2b1hmK3Ura21qNlgvczdvdUN5TVFqc205SDJaUFJPRGFCb3RLeUk2VW1nN1laMTJLd0RXUWRXeXJ3UDE0YWIwcitueVo2SEpDNG55dGxrMHY1ajl1cDVtbURwOHNNdGZ0Nmo2SG1oUGYvQ1dDN1Nqc1pFTG44TS9zWDVUeGlsOFROMncvYzZ3QmtQUmdXRjJxdVphY2duRlBlSDdZUHBqZXFmZEZMOVZwdjlldHBXK21xWGdSRDhDRHJlMVUvM2lDWVlqajdSaE9NamU0QmorZFRiM3BzODVIdnNRMnpJdlRMN3FZNjBRVTJUTHJrbnNjd0tibkU5c2h5by9hc3FlS3E5NERVTUduWkhwcUtRelEvaHZlN2h0b3lmOEx0TWZZOTJLU2grZ1A4eCs0OTlXbUtNWnd0Q0RFVU9PbG9JVkt2TkVxc1pENWZTMzRrbjAxRlhxQUloK202blBvelhlZ2JLWVlGaGRpa3dQbnFROHlKcnhIS3lrTTJMQmlibFN4T1FqK3R4Uk8xZzY4RnFqalBacjk4QWhlMnVwdkRYZFFmdkRLYytpQjJqVHVwNytqNk5oYUI2cHFOZkpvZUVvMmVja3QyM2w4ZUJMZisramZwQncrQ1MyYVJ5RnBxMnJrdG5mNUJKVmRhT1hYM2YyYkJyV29uaWh6WmFiWnI5amJaR3prV3ViRnRxU3loQWMrNk5jSEpPN3kzamdhZTVnNjcrT1pyT3pFM2U2dS9Ma29YTExWVFNaUHRaZHJscXFLalF6Y25PZ3UxelE3SDZpempibDc4WUdlMW81L3JtNjVyYkwrQkpZTWxoRzdsNldyRWtWYkJXbXFwbmhlelpJdU1WUE5CQmlmM2VsdGZtdGRUb2JPWWZMeW5jVitxZno0NGh0ZEhPRWVMbWRRVm0wblRNZWtya2hCV2RJRnpBaG15QWtvY1ZFMXgzbWRxUHRIYXJNVVZSMkgxRjhvcDFFc0YzZXd3S2dPRVp5aDVIekN5bWNheEN3bnZQaENhWVVIVllVZFZmN0tsR01MVlRFbmxBZHp5UzloUFRrSyt1UjFXbFl4aFVGTG0rZkVpVWYySEova3JUdkRXbnowcEpMNzl4elloL21JMjlKR2tpeTNpUUlwVGdWeEQ5SG9qR2J0YlZoajlaYnI1S2toUDdSWnl3akR3NTBMWlJLRG9ZUzFKN0pKUWpGaU9vbmZPckZ3MU1MTjRDNXVmR0Jkd2VLT21NaUZwZk1MWXpGZkl2RWg4YkRjbXd1MkJMR0N6Y2xnNDRqZDBPalNSUGVKRWxiNDVPQUkxaER4Z2RnMHhDSlhTa3d1MWRJcFRnQnQzUW9lVFNVVWZpTUgwazYrR05NZEMvckZGRzhxelV1bGFCMnNTbFF6NUNWNG0wcFZaODVNejFYUUg1V1RZdWxxY25ndklKeWFJamRyc0drUlIxYm5mRmNEYllpQVJZTHNlY3h6elU4aVY4L0IxcWNsd2pJTjdvU0RCMFZMUmJzNmsxS3o3SWJHTkhhMWxzaXdLakdBUU1vZXg4aWluM1R4Tmt5Sm0wbzgxeVBCNXhwSmQ0K2V5OUpxdzZRazZWQ0VncUJVeVc4WUVUb0tGMXYwWVhWYndoN0RBWFBnMG10NU9HYklocnBQVVIwOUptRGdZOUZhK2wrak9wdkFaNXJpRm9xMDBHN2RKWnZNNXpQR2s5V1VvYnZsZ3RDT3N0YkUrTXptbDBBS3NHU3BXRlV3V2pLUjNmSTdNanN3TFUyMjA1UkdWVHMrM09JNng3SjZTc1R0WEMrQlZBSEZrOHBwZXI3Q3VuRkxnUVcrc1RELzZ2MTNVeDdZajhIRytKelVxRkltc0YxejVVbE5JNU9ERnNpbzNBUGxFa3FjTElrZ2xCS3RiQXJVSU9waDVvZ1dwOUdGWmxER3QrOFlqcS9vTys4dmVQWU03ZWErNEQ1RHI2UmpNUktxSmFXZzMwdlMyL21YamY2STBvMDZOM2c2c1A3R0pmaldZM0Z3R0xJYnhZbzJoWlRuWE5JUWV3SDY5SmVKWFZQNGIvanJFMXN5NmRJUDBna3hJV0wvSGxpcXRrSkpoZ3ZzNjJ2RUZOTTlPbFlUelpuaUlDTGpJWmVLUTZJcDUrSU8zRWpGWjJIcVNFL29senVxQjFUNlVjd0x4TmI0aGhFYmlraDFZL25LMXRlS1psaGZadnBLK1dIOVM5YXFhdWJyTXlFQm9zRnJsVUIxZEFsanlzN2p6V0FlazMxME9XZU91cm5HbEZXTjBIK2d5ZkdyakY4R2lJQjFXT0s0MXlDeW1qZm01N2pGOFpuME5YWEtYNm1VdFdmRzd1TFBGWE01K2NCMU91TUE1TjN3QVZheEtDWlNjR1BNTG1wenVvU3AvejR3bXVVUHJJOHp4TUM2TzdnbFc5UjlQcno5bkY5QjQ1cThoNnFzTXdkdmVnODJ0OTcvbW1pWlpZTEoyTE5EMVN2eGFCVExsTTVxZ3EvTTI3NDBxMFFCemh0MTlKMEQ5NmJTblZxZHpKU2p1bzR5b1gxb2paUzNYT2Y5UGUwbCt4bWtBRjFDaXpPK2U2aTZtdWxqV1pyMkFaYUZVaUlNZmQ1aWd5OFpGRmUwNFNqdEEyWWdwUE9MbzZMNml4NlQ5Q1c0RUJZeVkyZVJmTE52NlBCeWgvOHVEZWlLYzdxUkgvbkNMdUxLc3NDUGJiNk5MRVhpYmx5dzlVQmxXV0thMWxTbjJFYTBGYW53ODFGMWJ5QUlXZHNWQkJOR29rVFo4bVRqUHJsS1k0MDlFbWRRbkZDRHVIN25mKzUxMUpCVDRaS1RCK3UydzRyY2FpVm5ZeGYySmw5bFk5M0RQeVQ1dlhneGxoWFJDSkhkZWRkVEtOSmsxNjdtMEo3MFF1bG91K3JKV2hyVytVOXVOT2JtZFpMeW1uVXlWbHd0NVppZjJITDcxd2NTZE9vOC8yeTFhQnV0MXhQRFlyR05yNUs0YytZc1kwMmxNd0oyOTNjcmNDM2dXMGhiTmtwODF0M29XdkJtcExqdjMxcTBERllUNENybVcrekpYR0lpM1cveHdROUc4c2U4OTNZQkcwbHVQTEZ0ODh3MmFFVWk0YXpqZFZ1dTNJdW52K0YvZytRN0hZb0dCOGk3d0FBQUFCSlJVNUVya0pnZ2c9PSIvPgoJPC9kZWZzPgoJPHN0eWxlPgoJPC9zdHlsZT4KCTx1c2UgaWQ9IkJhY2tncm91bmQiIGhyZWY9IiNpbWcxIiB4PSIzIiB5PSIzMSIvPgo8L3N2Zz4=';

    config: Required<TomoWalletAdapterConfig>;
    private _readyState: WalletReadyState = isInBrowser() ? WalletReadyState.Loading : WalletReadyState.NotFound;
    private _state: AdapterState = AdapterState.Loading;
    private _connecting: boolean;
    private _wallet: Tron | null;
    private _address: string | null;

    constructor(config: TomoWalletAdapterConfig = {}) {
        super();
        const { checkTimeout = 3 * 1000, dappIcon = '', dappName = '', openUrlWhenWalletNotFound = true } = config;
        if (typeof checkTimeout !== 'number') {
            throw new Error('[TomoWalletAdapter] config.checkTimeout should be a number');
        }
        this.config = {
            checkTimeout,
            openUrlWhenWalletNotFound,
            dappIcon,
            dappName,
        };
        this._connecting = false;
        this._wallet = null;
        this._address = null;

        if (!isInBrowser()) {
            this._readyState = WalletReadyState.NotFound;
            this.setState(AdapterState.NotFound);
            return;
        }
        if (isInMobileBrowser() && supportTomowallet()) {
            this._readyState = WalletReadyState.Found;
            this._updateWallet();
        } else {
            this._checkWallet().then(() => {
                if (this.connected) {
                    this.emit('connect', this.address || '');
                }
            });
        }
    }

    get address() {
        return this._address;
    }

    get state() {
        return this._state;
    }
    get readyState() {
        return this._readyState;
    }

    get connecting() {
        return this._connecting;
    }

    /**
     * Get network information used by Tomo. Currently not supported yet.
     * @returns {Network} Current network information.
     */
    async network(): Promise<Network> {
        try {
            await this._checkWallet();
            if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
            const tronWeb = this._wallet?.tronWeb;
            if (!tronWeb) throw new WalletDisconnectedError();
            try {
                return await getNetworkInfoByTronWeb(tronWeb);
            } catch (e: any) {
                throw new WalletGetNetworkError(e?.message, e);
            }
        } catch (e: any) {
            this.emit('error', e);
            throw e;
        }
    }

    async connect(): Promise<void> {
        try {
            if (this.connected || this.connecting) return;
            await this._checkWallet();
            if (this.state === AdapterState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }
            if (!this._wallet) return;
            this._connecting = true;
            if (supportTomowallet()) {
                const wallet = this._wallet;
                try {
                    const res = await wallet.request({ method: 'eth_requestAccounts' });
                    if (!res) {
                        // 1. wallet is locked
                        throw new WalletConnectionError('Tomo wallet is locked or no wallet account is avaliable.');
                    }
                } catch (error: any) {
                    throw new WalletConnectionError(error?.message, error);
                }

                const address = (wallet.tronWeb && wallet.tronWeb.defaultAddress?.base58) || '';
                this.setAddress(address);
                this.setState(AdapterState.Connected);
            } else {
                throw new WalletConnectionError('Cannot connect wallet.');
            }
            this.connected && this.emit('connect', this.address || '');
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.state !== AdapterState.Connected) {
            return;
        }
        this.setAddress(null);
        this.setState(AdapterState.Disconnect);
        this.emit('disconnect');
    }

    async signTransaction(transaction: Transaction, privateKey?: string): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.sign(transaction, privateKey);
            } catch (error: any) {
                if (error instanceof Error) {
                    throw new WalletSignTransactionError(error.message, error);
                } else {
                    throw new WalletSignTransactionError(error, new Error(error));
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async multiSign(
        transaction: Transaction,
        privateKey?: string | false,
        permissionId?: number
    ): Promise<SignedTransaction> {
        try {
            const wallet = await this.checkAndGetWallet();

            try {
                return await wallet.tronWeb.trx.multiSign(transaction, privateKey, permissionId);
            } catch (error: any) {
                if (error instanceof Error) {
                    throw new WalletSignTransactionError(error.message, error);
                } else {
                    throw new WalletSignTransactionError(error, new Error(error));
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signMessage(message: string, privateKey?: string): Promise<string> {
        try {
            const wallet = await this.checkAndGetWallet();
            try {
                return await wallet.tronWeb.trx.signMessageV2(message, privateKey);
            } catch (error: any) {
                if (error instanceof Error) {
                    throw new WalletSignMessageError(error.message, error);
                } else {
                    throw new WalletSignMessageError(error, new Error(error));
                }
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Switch to target chain. If current chain is the same as target chain, the call will success immediately.
     * Available chainIds:
     * - Mainnet: 0x2b6653dc
     * - Shasta: 0x94a9059e
     * - Nile: 0xcd8690dc
     * @param chainId chainId
     */
    async switchChain(chainId: string) {
        try {
            await this._checkWallet();
            if (this.state === AdapterState.NotFound) {
                if (this.config.openUrlWhenWalletNotFound !== false && isInBrowser()) {
                    window.open(this.url, '_blank');
                }
                throw new WalletNotFoundError();
            }
            const wallet = this._wallet as Tron;
            try {
                await wallet.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId }],
                });
            } catch (e: any) {
                throw new WalletSwitchChainError(e?.message || e, e instanceof Error ? e : new Error(e));
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private async checkAndGetWallet() {
        await this._checkWallet();
        if (this.state !== AdapterState.Connected) throw new WalletDisconnectedError();
        const wallet = this._wallet;
        if (!wallet || !wallet.tronWeb) throw new WalletDisconnectedError();
        return wallet as Tron & { tronWeb: TronWeb };
    }

    private _checkPromise: Promise<boolean> | null = null;
    /**
     * check if wallet exists by interval, the promise only resolve when wallet detected or timeout
     * @returns if wallet exists
     */
    private _checkWallet(): Promise<boolean> {
        if (this.readyState === WalletReadyState.Found) {
            return Promise.resolve(true);
        }
        if (this._checkPromise) {
            return this._checkPromise;
        }
        const interval = 100;
        const checkTronTimes = Math.floor(2000 / interval);
        const maxTimes = Math.floor(this.config.checkTimeout / interval);
        let times = 0,
            timer: ReturnType<typeof setInterval>;
        this._checkPromise = new Promise((resolve) => {
            const check = () => {
                times++;
                const isSupport = times < checkTronTimes && !!isInMobileBrowser() && supportTomowallet();
                if (isSupport || times > maxTimes) {
                    timer && clearInterval(timer);
                    this._readyState = isSupport ? WalletReadyState.Found : WalletReadyState.NotFound;
                    this._updateWallet();
                    this.emit('readyStateChanged', this.readyState);
                    resolve(isSupport);
                }
            };
            timer = setInterval(check, interval);
            check();
        });
        return this._checkPromise;
    }

    private listenToEvents() {
        this.stopEventListening();
        // @ts-ignore
        this._wallet?.on('accountsChanged', this.onAccountsChanged);
    }

    private stopEventListening() {
        if (this._wallet) {
            this._wallet.removeListener('accountsChanged', this.onAccountsChanged);
        }
    }

    private onAccountsChanged = (account: string) => {
        if (this._state === AdapterState.Disconnect) {
            return;
        }
        const preAddr = this.address || '';
        if (account !== preAddr) {
            this.setAddress(account);
            this.emit('accountsChanged', this.address || '', preAddr);
        }
        if (!preAddr && this.address) {
            this.emit('connect', this.address);
        } else if (preAddr && !this.address) {
            this.emit('disconnect');
        }
    };

    private _updateWallet = () => {
        let state = this.state;
        let address = this.address;
        if (isInMobileBrowser()) {
            if (window.tomo_wallet?.tron) {
                this._wallet = window.tomo_wallet.tron;
                this.listenToEvents();
            }
            address = (this._wallet?.tronWeb && this._wallet?.tronWeb?.defaultAddress?.base58) || null;
            state = address ? AdapterState.Connected : AdapterState.Disconnect;
        } else {
            console.error('[TomoWalletAdapter] Only supported in mobile app for now');
            this._wallet = null;
            address = null;
            state = AdapterState.NotFound;
        }
        // In Tomo Wallet App, account should be connected
        if (isInMobileBrowser() && state === AdapterState.Disconnect) {
            this.checkForWalletReadyForApp();
        }
        this.setAddress(address);
        this.setState(state);
    };

    private checkReadyInterval: ReturnType<typeof setInterval> | null = null;
    private checkForWalletReadyForApp() {
        if (this.checkReadyInterval) {
            return;
        }
        let times = 0;
        const maxTimes = Math.floor(this.config.checkTimeout / 200);
        const check = () => {
            if (window.tomo_wallet?.tron?.tronWeb && window.tomo_wallet?.tron?.tronWeb?.defaultAddress) {
                this.checkReadyInterval && clearInterval(this.checkReadyInterval);
                this.checkReadyInterval = null;
                this._updateWallet();
                this.emit('connect', this.address || '');
            } else if (times > maxTimes) {
                this.checkReadyInterval && clearInterval(this.checkReadyInterval);
                this.checkReadyInterval = null;
            } else {
                times++;
            }
        };
        this.checkReadyInterval = setInterval(check, 200);
    }
    private setAddress(address: string | null) {
        this._address = address;
    }

    private setState(state: AdapterState) {
        const preState = this.state;
        if (state !== preState) {
            this._state = state;
            this.emit('stateChanged', state);
        }
    }
}
