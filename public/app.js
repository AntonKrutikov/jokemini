import { initTheme } from "./modules/theme.js";
import { initSidebar } from "./modules/sidebar.js";
import { ensureInitialDialog } from "./modules/dialogs-store.js";
import {
  renderSidebar,
  renderConversation,
  initDialogControls,
} from "./modules/conversation-view.js";
import { initChat } from "./modules/chat.js";
import { initDebugFlags } from "./modules/debug-flags.js";

initTheme();
initSidebar();
ensureInitialDialog();
renderSidebar();
renderConversation();
initDialogControls();
initDebugFlags();
initChat();
