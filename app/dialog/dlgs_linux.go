//go:build linux

package dialog

/*
#cgo pkg-config: gtk+-3.0
#include <gtk/gtk.h>

static GtkDialog* cast_dialog(GtkWidget *w) { return GTK_DIALOG(w); }
static GtkFileChooser* cast_file_chooser(GtkWidget *w) { return GTK_FILE_CHOOSER(w); }
static GtkWindow* cast_window(GtkWidget *w) { return GTK_WINDOW(w); }

static GtkWidget* new_message_dialog(GtkWindow *parent, GtkDialogFlags flags, GtkMessageType type, GtkButtonsType buttons, const char *msg) {
	return gtk_message_dialog_new(parent, flags, type, buttons, "%s", msg);
}

static GtkWidget* new_file_chooser_dialog(const char *title, GtkWindow *parent, GtkFileChooserAction action, const char *cancel_label, const char *accept_label) {
	return gtk_file_chooser_dialog_new(title, parent, action, cancel_label, GTK_RESPONSE_CANCEL, accept_label, GTK_RESPONSE_ACCEPT, NULL);
}
*/
import "C"

import (
	"strings"
	"unsafe"
)

func (b *MsgBuilder) yesNo() bool {
	title := firstOf(b.Dlg.Title, "Confirm")
	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))
	cMsg := C.CString(b.Msg)
	defer C.free(unsafe.Pointer(cMsg))

	dlg := C.new_message_dialog(nil, C.GTK_DIALOG_MODAL, C.GTK_MESSAGE_QUESTION, C.GTK_BUTTONS_YES_NO, cMsg)
	C.gtk_window_set_title(C.cast_window(dlg), cTitle)
	defer C.gtk_widget_destroy(dlg)

	resp := C.gtk_dialog_run(C.cast_dialog(dlg))
	return resp == C.GTK_RESPONSE_YES
}

func (b *MsgBuilder) info() {
	title := firstOf(b.Dlg.Title, "Information")
	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))
	cMsg := C.CString(b.Msg)
	defer C.free(unsafe.Pointer(cMsg))

	dlg := C.new_message_dialog(nil, C.GTK_DIALOG_MODAL, C.GTK_MESSAGE_INFO, C.GTK_BUTTONS_OK, cMsg)
	C.gtk_window_set_title(C.cast_window(dlg), cTitle)
	defer C.gtk_widget_destroy(dlg)

	C.gtk_dialog_run(C.cast_dialog(dlg))
}

func (b *MsgBuilder) error() {
	title := firstOf(b.Dlg.Title, "Error")
	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))
	cMsg := C.CString(b.Msg)
	defer C.free(unsafe.Pointer(cMsg))

	dlg := C.new_message_dialog(nil, C.GTK_DIALOG_MODAL, C.GTK_MESSAGE_ERROR, C.GTK_BUTTONS_OK, cMsg)
	C.gtk_window_set_title(C.cast_window(dlg), cTitle)
	defer C.gtk_widget_destroy(dlg)

	C.gtk_dialog_run(C.cast_dialog(dlg))
}

func (b *FileBuilder) load() (string, error) {
	return b.runFileDlg(C.GTK_FILE_CHOOSER_ACTION_OPEN, false)
}

func (b *FileBuilder) loadMultiple() ([]string, error) {
	return b.runMultiFileDlg()
}

func (b *FileBuilder) save() (string, error) {
	return b.runFileDlg(C.GTK_FILE_CHOOSER_ACTION_SAVE, true)
}

func (b *FileBuilder) runFileDlg(action C.GtkFileChooserAction, save bool) (string, error) {
	title := firstOf(b.Dlg.Title, "Select File")
	if save {
		title = firstOf(b.Dlg.Title, "Save File")
	}
	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))

	var btnLabel string
	if save {
		btnLabel = "_Save"
	} else {
		btnLabel = "_Open"
	}
	cBtnLabel := C.CString(btnLabel)
	defer C.free(unsafe.Pointer(cBtnLabel))
	cCancelLabel := C.CString("_Cancel")
	defer C.free(unsafe.Pointer(cCancelLabel))

	dlg := C.new_file_chooser_dialog(cTitle, nil, action, cCancelLabel, cBtnLabel)
	defer C.gtk_widget_destroy(dlg)

	chooser := C.cast_file_chooser(dlg)
	if b.StartDir != "" {
		cDir := C.CString(b.StartDir)
		C.gtk_file_chooser_set_current_folder(chooser, cDir)
		C.free(unsafe.Pointer(cDir))
	}
	if save && b.StartFile != "" {
		cFile := C.CString(b.StartFile)
		C.gtk_file_chooser_set_current_name(chooser, cFile)
		C.free(unsafe.Pointer(cFile))
	}
	addFileFilters(chooser, b.Filters)
	if b.ShowHiddenFiles {
		C.gtk_file_chooser_set_show_hidden(chooser, C.TRUE)
	}

	resp := C.gtk_dialog_run(C.cast_dialog(dlg))
	if resp == C.GTK_RESPONSE_ACCEPT {
		filename := C.gtk_file_chooser_get_filename(chooser)
		defer C.g_free(C.gpointer(filename))
		return C.GoString(filename), nil
	}
	return "", ErrCancelled
}

func (b *FileBuilder) runMultiFileDlg() ([]string, error) {
	title := firstOf(b.Dlg.Title, "Select Files")
	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))
	cOpenLabel := C.CString("_Open")
	defer C.free(unsafe.Pointer(cOpenLabel))
	cCancelLabel := C.CString("_Cancel")
	defer C.free(unsafe.Pointer(cCancelLabel))

	dlg := C.new_file_chooser_dialog(cTitle, nil, C.GTK_FILE_CHOOSER_ACTION_OPEN, cCancelLabel, cOpenLabel)
	defer C.gtk_widget_destroy(dlg)

	chooser := C.cast_file_chooser(dlg)
	C.gtk_file_chooser_set_select_multiple(chooser, C.TRUE)
	addFileFilters(chooser, b.Filters)
	if b.StartDir != "" {
		cDir := C.CString(b.StartDir)
		C.gtk_file_chooser_set_current_folder(chooser, cDir)
		C.free(unsafe.Pointer(cDir))
	}
	if b.ShowHiddenFiles {
		C.gtk_file_chooser_set_show_hidden(chooser, C.TRUE)
	}

	resp := C.gtk_dialog_run(C.cast_dialog(dlg))
	if resp == C.GTK_RESPONSE_ACCEPT {
		filenames := C.gtk_file_chooser_get_filenames(chooser)
		var result []string
		for p := filenames; p != nil; p = p.next {
			if p.data != nil {
				s := C.GoString((*C.char)(unsafe.Pointer(p.data)))
				result = append(result, s)
			}
			C.g_free(p.data)
		}
		C.g_slist_free(filenames)
		return result, nil
	}
	return nil, ErrCancelled
}

func (b *DirectoryBuilder) browse() (string, error) {
	title := firstOf(b.Dlg.Title, "Select Directory")
	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))
	cOpenLabel := C.CString("_Open")
	defer C.free(unsafe.Pointer(cOpenLabel))
	cCancelLabel := C.CString("_Cancel")
	defer C.free(unsafe.Pointer(cCancelLabel))

	dlg := C.new_file_chooser_dialog(cTitle, nil, C.GTK_FILE_CHOOSER_ACTION_SELECT_FOLDER, cCancelLabel, cOpenLabel)
	defer C.gtk_widget_destroy(dlg)

	chooser := C.cast_file_chooser(dlg)
	if b.StartDir != "" {
		cDir := C.CString(b.StartDir)
		C.gtk_file_chooser_set_current_folder(chooser, cDir)
		C.free(unsafe.Pointer(cDir))
	}
	if b.ShowHiddenFiles {
		C.gtk_file_chooser_set_show_hidden(chooser, C.TRUE)
	}

	resp := C.gtk_dialog_run(C.cast_dialog(dlg))
	if resp == C.GTK_RESPONSE_ACCEPT {
		filename := C.gtk_file_chooser_get_filename(chooser)
		defer C.g_free(C.gpointer(filename))
		return C.GoString(filename), nil
	}
	return "", ErrCancelled
}

func addFileFilters(chooser *C.GtkFileChooser, filters []FileFilter) {
	for _, f := range filters {
		filter := C.gtk_file_filter_new()
		label := f.Desc
		if label == "" {
			label = strings.Join(f.Extensions, ", ")
		}
		cLabel := C.CString(label)
		C.gtk_file_filter_set_name(filter, cLabel)
		C.free(unsafe.Pointer(cLabel))
		for _, ext := range f.Extensions {
			pattern := C.CString("*." + ext)
			C.gtk_file_filter_add_pattern(filter, pattern)
			C.free(unsafe.Pointer(pattern))
		}
		C.gtk_file_chooser_add_filter(chooser, filter)
	}
}