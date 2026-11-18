package com.nagem.aqsa.pdf

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import com.nagem.aqsa.data.local.BasicCostStockRow
import com.nagem.aqsa.data.local.DailyAmountRow
import com.nagem.aqsa.data.local.DailyMovementRow
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

object StockPdfExporter {

    private const val PAGE_WIDTH = 842 // A4 Landscape (pt)
    private const val PAGE_HEIGHT = 595
    private const val MARGIN = 24f
    private const val ROW_HEIGHT = 20f
    private const val ROWS_PER_PAGE = 19

    /**
     * Basic Stock Report (Cost Only, NO Markup / NO Selling Price)
     * Includes Category, Sub-Category, Item Unit, Item Weight, Sold Invoice Numbers, Page Totals & Grand Total.
     */
    fun exportBasicCostStockPdf(
        context: Context,
        rows: List<BasicCostStockRow>,
        companyName: String = "N.A GEM'S"
    ): File {
        val doc = PdfDocument()
        val headerPaint = Paint().apply {
            color = Color.rgb(6, 78, 59)
            textSize = 13.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 9f
        }
        val thPaint = Paint().apply {
            color = Color.WHITE
            textSize = 7.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val cellPaint = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 7.5f
        }
        val boldCellPaint = Paint().apply {
            color = Color.rgb(6, 78, 59)
            textSize = 7.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val bgHeader = Paint().apply { color = Color.rgb(6, 78, 59) }
        val bgFooter = Paint().apply { color = Color.rgb(241, 245, 249) }
        val bgGrand = Paint().apply { color = Color.rgb(236, 253, 245) }

        val pages = if (rows.isEmpty()) listOf(emptyList()) else rows.chunked(ROWS_PER_PAGE)
        val totalPages = pages.size

        val grandPcs = rows.sumOf { it.stockPieces }
        val grandWeight = rows.sumOf { it.itemWeight }
        val grandInHand = rows.sumOf { it.inHandQuantity }
        val grandCostPkr = rows.sumOf { it.totalCostPkr }

        val colX = floatArrayOf(24f, 86f, 158f, 230f, 272f, 322f, 360f, 415f, 485f, 540f, 645f)
        val headers = arrayOf(
            "SKU", "Category", "Sub-Cat", "Unit", "Item Wt",
            "Pcs", "In-Hand", "Cost/Unit", "FX->PKR", "Total Cost (PKR)", "Sold Invoices"
        )

        pages.forEachIndexed { pageIndex, pageRows ->
            val pageNumber = pageIndex + 1
            val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
            val page = doc.startPage(pageInfo)
            val canvas = page.canvas

            canvas.drawText("$companyName — Stock Report (Original Cost Only, NO Markup)", MARGIN, 32f, headerPaint)
            canvas.drawText(
                "Aqsa Business Management System | Page $pageNumber of $totalPages",
                MARGIN,
                48f,
                subPaint
            )

            var y = 64f
            canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + ROW_HEIGHT, bgHeader)
            headers.forEachIndexed { i, title ->
                canvas.drawText(title, colX[i] + 3f, y + 13f, thPaint)
            }
            y += ROW_HEIGHT

            pageRows.forEach { row ->
                val vals = arrayOf(
                    row.sku.take(11),
                    row.category.take(12),
                    row.subCategory.take(12),
                    row.itemUnit.take(7),
                    fmt(row.itemWeight),
                    row.stockPieces.toString(),
                    fmt(row.inHandQuantity),
                    "${row.costCurrency} ${fmt(row.originalCostPrice)}",
                    fmt(row.fxRateToPkr),
                    "PKR ${fmt(row.totalCostPkr)}",
                    row.soldInvoiceNumbers.ifBlank { "—" }.take(24)
                )
                vals.forEachIndexed { i, v ->
                    canvas.drawText(v, colX[i] + 3f, y + 13f, cellPaint)
                }
                y += ROW_HEIGHT
            }

            val footerY = PAGE_HEIGHT - 64f
            canvas.drawRect(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY + 22f, bgFooter)
            canvas.drawText("Page $pageNumber Total:", colX[0] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.itemWeight }), colX[4] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(pageRows.sumOf { it.stockPieces }.toString(), colX[5] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.inHandQuantity }), colX[6] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText("PKR ${fmt(pageRows.sumOf { it.totalCostPkr })}", colX[9] + 3f, footerY + 14f, boldCellPaint)

            if (pageNumber == totalPages) {
                val grandY = PAGE_HEIGHT - 38f
                canvas.drawRect(MARGIN, grandY, PAGE_WIDTH - MARGIN, grandY + 24f, bgGrand)
                canvas.drawText("GRAND TOTAL:", colX[0] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandWeight), colX[4] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(grandPcs.toString(), colX[5] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandInHand), colX[6] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText("PKR ${fmt(grandCostPkr)}", colX[9] + 3f, grandY + 15f, boldCellPaint)
            }

            doc.finishPage(page)
        }

        val outFile = File(context.cacheDir, "Stock_Cost_Only_Report_${System.currentTimeMillis()}.pdf")
        FileOutputStream(outFile).use { doc.writeTo(it) }
        doc.close()
        return outFile
    }

    /**
     * Report 1: Daily Stock Movement Report
     * Quantities only — NO amount, cost, or price.
     * Includes Category, Sub-Category, Item Unit, Item Weight, Page Totals on EVERY page, and Grand Total on the final page.
     */
    fun exportDailyMovementPdf(
        context: Context,
        rows: List<DailyMovementRow>,
        reportDateLabel: String = "Daily",
        companyName: String = "N.A GEM'S"
    ): File {
        val doc = PdfDocument()
        val headerPaint = Paint().apply {
            color = Color.rgb(6, 78, 59)
            textSize = 13.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 9f
        }
        val thPaint = Paint().apply {
            color = Color.WHITE
            textSize = 7.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val cellPaint = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 7.5f
        }
        val boldCellPaint = Paint().apply {
            color = Color.rgb(6, 78, 59)
            textSize = 7.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val bgHeader = Paint().apply { color = Color.rgb(6, 78, 59) }
        val bgFooter = Paint().apply { color = Color.rgb(241, 245, 249) }
        val bgGrand = Paint().apply { color = Color.rgb(236, 253, 245) }

        val pages = if (rows.isEmpty()) listOf(emptyList()) else rows.chunked(ROWS_PER_PAGE)
        val totalPages = pages.size

        val grandItemWt = rows.sumOf { it.itemWeight }
        val grandInHand = rows.sumOf { it.inHandQuantity }
        val grandPurchased = rows.sumOf { it.purchasedQuantity }
        val grandLoss = rows.sumOf { it.lossQuantity }
        val grandWeight = rows.sumOf { it.weight }
        val grandSoldQty = rows.sumOf { it.soldItemQuantity }
        val grandSoldPcs = rows.sumOf { it.soldPieces }
        val grandInvoices = rows.sumOf { it.numberOfInvoices }

        val colX = floatArrayOf(24f, 84f, 152f, 222f, 266f, 316f, 376f, 438f, 492f, 550f, 616f, 684f)
        val headers = arrayOf(
            "SKU", "Category", "Sub-Cat", "Unit", "Item Wt",
            "In-Hand", "Purchased", "Loss", "Total Wt", "Sold Qty", "Sold Pcs", "Invoices #"
        )

        pages.forEachIndexed { pageIndex, pageRows ->
            val pageNumber = pageIndex + 1
            val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
            val page = doc.startPage(pageInfo)
            val canvas = page.canvas

            canvas.drawText("$companyName — Daily Stock Movement Report (Quantities Only)", MARGIN, 32f, headerPaint)
            canvas.drawText(
                "Aqsa Business Management System | Period: $reportDateLabel | Page $pageNumber of $totalPages",
                MARGIN,
                48f,
                subPaint
            )

            var y = 64f
            canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + ROW_HEIGHT, bgHeader)
            headers.forEachIndexed { i, title ->
                canvas.drawText(title, colX[i] + 3f, y + 13f, thPaint)
            }
            y += ROW_HEIGHT

            pageRows.forEach { row ->
                val vals = arrayOf(
                    row.sku.take(11),
                    row.category.take(12),
                    row.subCategory.take(12),
                    row.itemUnit.take(7),
                    fmt(row.itemWeight),
                    fmt(row.inHandQuantity),
                    fmt(row.purchasedQuantity),
                    fmt(row.lossQuantity),
                    fmt(row.weight),
                    fmt(row.soldItemQuantity),
                    row.soldPieces.toString(),
                    row.numberOfInvoices.toString()
                )
                vals.forEachIndexed { i, v ->
                    canvas.drawText(v, colX[i] + 3f, y + 13f, cellPaint)
                }
                y += ROW_HEIGHT
            }

            // Page Total Bar on EVERY single page
            val footerY = PAGE_HEIGHT - 64f
            canvas.drawRect(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY + 22f, bgFooter)
            canvas.drawText("Page $pageNumber Total:", colX[0] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.itemWeight }), colX[4] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.inHandQuantity }), colX[5] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.purchasedQuantity }), colX[6] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.lossQuantity }), colX[7] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.weight }), colX[8] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.soldItemQuantity }), colX[9] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(pageRows.sumOf { it.soldPieces }.toString(), colX[10] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(pageRows.sumOf { it.numberOfInvoices }.toString(), colX[11] + 3f, footerY + 14f, boldCellPaint)

            // Final Grand Total Row on the LAST page
            if (pageNumber == totalPages) {
                val grandY = PAGE_HEIGHT - 38f
                canvas.drawRect(MARGIN, grandY, PAGE_WIDTH - MARGIN, grandY + 24f, bgGrand)
                canvas.drawText("GRAND TOTAL:", colX[0] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandItemWt), colX[4] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandInHand), colX[5] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandPurchased), colX[6] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandLoss), colX[7] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandWeight), colX[8] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandSoldQty), colX[9] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(grandSoldPcs.toString(), colX[10] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(grandInvoices.toString(), colX[11] + 3f, grandY + 15f, boldCellPaint)
            }

            doc.finishPage(page)
        }

        val outFile = File(context.cacheDir, "Daily_Stock_Movement_${System.currentTimeMillis()}.pdf")
        FileOutputStream(outFile).use { doc.writeTo(it) }
        doc.close()
        return outFile
    }

    /**
     * Report 2: Daily Amount Wise Stock Report
     * Original Cost Price & Total Cost Amount ONLY (NO markup, NO selling price).
     * Includes Category, Sub-Category, Item Unit, Item Weight, Page Totals on EVERY page & Grand Total on final page.
     */
    fun exportDailyAmountStockPdf(
        context: Context,
        rows: List<DailyAmountRow>,
        reportDateLabel: String = "Daily",
        companyName: String = "N.A GEM'S"
    ): File {
        val doc = PdfDocument()
        val headerPaint = Paint().apply {
            color = Color.rgb(6, 78, 59)
            textSize = 13.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 9f
        }
        val thPaint = Paint().apply {
            color = Color.WHITE
            textSize = 7.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val cellPaint = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 7.5f
        }
        val boldCellPaint = Paint().apply {
            color = Color.rgb(6, 78, 59)
            textSize = 7.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val bgHeader = Paint().apply { color = Color.rgb(6, 78, 59) }
        val bgFooter = Paint().apply { color = Color.rgb(241, 245, 249) }
        val bgGrand = Paint().apply { color = Color.rgb(236, 253, 245) }

        val pages = if (rows.isEmpty()) listOf(emptyList()) else rows.chunked(ROWS_PER_PAGE)
        val totalPages = pages.size

        val grandItemWt = rows.sumOf { it.itemWeight }
        val grandInHand = rows.sumOf { it.inHandQuantity }
        val grandCostPkr = rows.sumOf { it.totalCostPkr }

        val colX = floatArrayOf(24f, 84f, 152f, 222f, 266f, 316f, 376f, 424f, 492f, 550f, 640f)
        val headers = arrayOf(
            "SKU", "Category", "Sub-Cat", "Unit", "Item Wt",
            "In-Hand", "Cur", "Orig Cost", "FX->PKR", "Cost (Orig)", "Total Cost (PKR)"
        )

        pages.forEachIndexed { pageIndex, pageRows ->
            val pageNumber = pageIndex + 1
            val pageInfo = PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create()
            val page = doc.startPage(pageInfo)
            val canvas = page.canvas

            canvas.drawText("$companyName — Daily Amount Wise Stock Report (Original Cost Only)", MARGIN, 32f, headerPaint)
            canvas.drawText(
                "No Markup / No Selling Price | Period: $reportDateLabel | Page $pageNumber of $totalPages",
                MARGIN,
                48f,
                subPaint
            )

            var y = 64f
            canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + ROW_HEIGHT, bgHeader)
            headers.forEachIndexed { i, title ->
                canvas.drawText(title, colX[i] + 3f, y + 13f, thPaint)
            }
            y += ROW_HEIGHT

            pageRows.forEach { row ->
                val vals = arrayOf(
                    row.sku.take(11),
                    row.category.take(12),
                    row.subCategory.take(12),
                    row.itemUnit.take(7),
                    fmt(row.itemWeight),
                    fmt(row.inHandQuantity),
                    row.costCurrency,
                    fmt(row.originalCostPrice),
                    fmt(row.fxRateToPkr),
                    fmt(row.totalCostOrig),
                    "PKR ${fmt(row.totalCostPkr)}"
                )
                vals.forEachIndexed { i, v ->
                    canvas.drawText(v, colX[i] + 3f, y + 13f, cellPaint)
                }
                y += ROW_HEIGHT
            }

            // Page Total Bar on EVERY single page
            val footerY = PAGE_HEIGHT - 64f
            canvas.drawRect(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY + 22f, bgFooter)
            canvas.drawText("Page $pageNumber Total:", colX[0] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.itemWeight }), colX[4] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText(fmt(pageRows.sumOf { it.inHandQuantity }), colX[5] + 3f, footerY + 14f, boldCellPaint)
            canvas.drawText("PKR ${fmt(pageRows.sumOf { it.totalCostPkr })}", colX[10] + 3f, footerY + 14f, boldCellPaint)

            // Final Grand Total Row on the LAST page
            if (pageNumber == totalPages) {
                val grandY = PAGE_HEIGHT - 38f
                canvas.drawRect(MARGIN, grandY, PAGE_WIDTH - MARGIN, grandY + 24f, bgGrand)
                canvas.drawText("GRAND TOTAL (In-Hand Stock Cost):", colX[0] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandItemWt), colX[4] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText(fmt(grandInHand), colX[5] + 3f, grandY + 15f, boldCellPaint)
                canvas.drawText("PKR ${fmt(grandCostPkr)}", colX[10] + 3f, grandY + 15f, boldCellPaint)
            }

            doc.finishPage(page)
        }

        val outFile = File(context.cacheDir, "Daily_Amount_Wise_Stock_${System.currentTimeMillis()}.pdf")
        FileOutputStream(outFile).use { doc.writeTo(it) }
        doc.close()
        return outFile
    }

    private fun fmt(v: Double): String = String.format(Locale.US, "%.2f", v)
}
